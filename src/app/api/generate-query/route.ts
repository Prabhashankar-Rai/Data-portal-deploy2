import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import NodeCache from 'node-cache';
import pool from '@/lib/db';

// Global cache for HMR dev environments
const globalForCache = globalThis as unknown as {
    duckdbQueryCache: NodeCache | undefined
};
const sqlCache = globalForCache.duckdbQueryCache || new NodeCache({ stdTTL: 3600, checkperiod: 120 });
if (process.env.NODE_ENV !== "production") globalForCache.duckdbQueryCache = sqlCache;

// Load dynamic definitions
function loadDynamicConfig(filename: string, fallback: any) {
    try {
        const filePath = path.join(process.cwd(), 'data', filename);
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (e) {
        console.warn(`Failed to load ${filename}, using fallback.`);
        return fallback;
    }
}

const METRIC_DICTIONARY = loadDynamicConfig('ai-metrics.json', []);
const normalizations: Record<string, string[]> = loadDynamicConfig('ai-column-aliases.json', {});

export async function POST(req: NextRequest) {
    try {
        const { messages, datasetId } = await req.json();

        if (!messages || !Array.isArray(messages)) {
            return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
        }

        if (!datasetId) {
            return NextResponse.json({ error: 'datasetId is required. No dataset selected.' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const role = cookieStore.get('role')?.value || 'USER';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized to use AI chat.' }, { status: 403 });
        }

        const pool = (await import('@/lib/db')).default;

        // Quota Management
        let userQuota: any = null;
        if (role !== 'ADMIN') {
            const quotaRes = await pool.query('SELECT * FROM User_Quotas WHERE user_id::text = $1', [userId]);
            userQuota = quotaRes.rows[0];

            if (!userQuota) {
                // Initialize default quota
                const initRes = await pool.query(
                    'INSERT INTO User_Quotas (user_id, tokens_used, token_limit) VALUES ($1::uuid, 0, 100000) RETURNING *',
                    [userId]
                );
                userQuota = initRes.rows[0];
            }

            if (userQuota.tokens_used >= userQuota.token_limit) {
                return NextResponse.json({ error: 'Quota exceeded. Please recharge your API usage limits.' }, { status: 403 });
            }
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OpenAI API key not configured.' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        // Fetch dataset from DB
        let dataset: any = null;
        try {
            const res = await pool.query('SELECT * FROM Dataset WHERE dataset_id = $1', [datasetId]);
            if (res.rows.length > 0) {
                const row = res.rows[0];
                dataset = {
                    id: row.dataset_id,
                    displayLabel: row.dataset_label,
                    fileName: row.file_name,
                    filePath: row.file_path,
                    purpose: row.purpose,
                    columns: row.columns_json,
                    aiEnabled: true // Assuming database datasets are AI enabled by default for this app
                };
            }
        } catch (e) {
            console.error("Error reading dataset from DB", e);
        }

        if (!dataset) {
            return NextResponse.json({ error: 'Selected dataset not found.' }, { status: 404 });
        }

        const lastUserMessage = [...messages].reverse().find(m => m.role === 'user')?.content || '';
        
        let columnList = 'unknown';
        if (dataset.columns) {
            const availableCols = dataset.columns.filter((c: any) => !c.aiRestricted);
            
            // JIT Schema Pruning
            // Base analytical dimensions that should always be present if they exist
            const fallbackMandatoryBaseCols = ['year', 'month', 'date'];
            const lowerMsg = lastUserMessage.toLowerCase();
            const activeMetrics = METRIC_DICTIONARY.filter((m: any) => lowerMsg.includes(m.name.toLowerCase()));
            const requiredBaseCols = activeMetrics.flatMap((m: any) => m.required).map((c: string) => c.toLowerCase());
            
            const prunedCols = availableCols.filter((c: any) => {
                const lowerName = c.name.toLowerCase();
                const lowerDesc = c.description ? c.description.toLowerCase() : '';
                
                // 1. Keep if it's a generic base dimension like date/year/month
                if (fallbackMandatoryBaseCols.some(m => lowerName.includes(m))) return true;
                
                // 2. Keep if it's explicitly required by a matched calculated metric
                if (requiredBaseCols.some((req: string) => lowerName.includes(req) || lowerDesc.includes(req))) return true;
                
                // 3. Keep if the user explicitly mentioned a word close to the column name/description
                const nameWords = lowerName.split(/[_ ]+/);
                if (nameWords.some((w: string) => w.length > 2 && lowerMsg.includes(w))) return true;
                if (lowerDesc && lowerMsg.includes(lowerDesc)) return true;

                // 4. Keep if it matches an alias in normalizations
                const aliasMatch = Object.entries(normalizations).some(([key, aliases]) => {
                    const isAliasInUserMsg = aliases.some(a => lowerMsg.includes(a.toLowerCase()));
                    const isColRelatedToAlias = lowerName.includes(key) || aliases.some(a => lowerName.includes(a));
                    if (isAliasInUserMsg && isColRelatedToAlias) return true;
                    // Also check if the alias itself is part of the required base cols
                    if (requiredBaseCols.includes(key) && (lowerName.includes(key) || aliases.some(a => lowerName.includes(a)))) return true;
                    return false;
                });
                
                return aliasMatch;
            });

            // Fallback to full schema if pruning was suspiciously aggressive (e.g. less than 5 cols)
            if (prunedCols.length < 5) {
                columnList = availableCols.map((c: any) => `${c.name}${c.description ? `(${c.description})` : ''}`).join(', ');
            } else {
                columnList = prunedCols.map((c: any) => `${c.name}${c.description ? `(${c.description})` : ''}`).join(', ');
            }
        }
        
        const restrictedList = dataset.columns?.filter((c: any) => c.aiRestricted).map((c: any) => c.name).join(', ') || 'None';
        const missingColumns: string[] = [];
        const requiredMetrics = METRIC_DICTIONARY.filter((m: any) => lastUserMessage.toLowerCase().includes(m.name.toLowerCase()));
        
        for (const metric of requiredMetrics) {
            for (const reqCol of metric.required) {
                const term = reqCol.toLowerCase();
                const isDirectMatch = dataset.columns.some((c: any) => 
                    c.name.toLowerCase().includes(term) || 
                    (c.description && c.description.toLowerCase().includes(term))
                );
                
                if (!isDirectMatch) {
                    const norm = normalizations[term] || [];
                    const isNormMatch = norm.some(n => dataset.columns.some((c: any) => 
                        c.name.toLowerCase() === n.toLowerCase() || 
                        (c.description && c.description.toLowerCase().includes(n.toLowerCase()))
                    ));
                    
                    if (!isNormMatch) {
                        if (!missingColumns.includes(reqCol)) missingColumns.push(reqCol);
                    }
                }
            }
        }
        
        if (missingColumns.length > 0) {
            const formattedMissing = missingColumns.length === 1 ? missingColumns[0] : missingColumns.slice(0, -1).join(', ') + ' and ' + missingColumns[missingColumns.length - 1];
            return NextResponse.json({ 
                error: `This metric cannot be calculated because the dataset does not contain the required columns: ${formattedMissing}.` 
            }, { status: 400 });
        }

        // --- SQL CACHE EXECUTION (v5) ---
        const cacheKey = `sql_v5_${datasetId}_${Buffer.from(lastUserMessage.toLowerCase()).toString('base64').substring(0, 64)}`;
        if (sqlCache.has(cacheKey)) {
            console.log("CACHE HIT (v5): Serving cached SQL generation for:", lastUserMessage);
            const cachedPayload = sqlCache.get(cacheKey) as any;
            return NextResponse.json({ ...cachedPayload, cached: true });
        }
        // ---------------------------

        const metricRules = METRIC_DICTIONARY.map((m: any) => {
            let parsedFormula = m.formula;
            m.required.forEach((reqCol: string) => {
                const normList = normalizations[reqCol.toLowerCase()] || [];
                if (dataset?.columns) {
                    const matchedCol = dataset.columns.find((c: any) => 
                        c.name.toLowerCase() === reqCol.toLowerCase() || normList.includes(c.name.toLowerCase())
                    );
                    if (matchedCol) {
                        const regex = new RegExp(reqCol, "gi");
                        parsedFormula = parsedFormula.replace(regex, matchedCol.name);
                    }
                }
            });
            return `- ${m.name} = ${parsedFormula}`;
        }).join('\n');

        const systemPrompt = `You are an Insurance Analytics AI. Target table: \`dataset_view\`. Output JSON strictly.

Postgres SQL RULES:
1. CRITICAL: The ONLY valid table is \`dataset_view\` (do NOT use double quotes here). NEVER use 'src' or any schema column as the FROM table. EVERY query must contain \`FROM dataset_view\`.
2. Schema columns: ${columnList}
3. Restricted: ${restrictedList}
4. ONLY use exact DB column names from Schema above (descriptions in parens are just hints). If asked about Restricted/Missing cols, return exactly: \`SELECT 'Error: The requested column has been restricted by the Administrator for AI analysis.' AS insight;\`
5. Use double quotes for columns (\`"col"\`) and single quotes for strings/dates (\`'2025'\`, \`'%Y'\`).
6. Mathematical columns MUST be cast natively: CAST("col" AS NUMERIC).
7. Math Safety (CRITICAL): Wrap in COALESCE for nulls, and NULLIF for division by zero. Ex: \`(SUM(COALESCE(CAST("gic" AS NUMERIC), 0)) / NULLIF(SUM(COALESCE(CAST("gwp" AS NUMERIC), 0)), 0)) * 100\`
8. Vague Metrics (e.g., "loss ratio"): Infer intent, use METRICS formulas below. Do not reject. Add 2-3 advanced metrics in \`follow_up_questions\` (adhering strictly to Rule 20).
9. Date Filtering (CRITICAL): NEVER use \`LIKE\` on a DATE column. To filter by year, dynamically identify the correct date column from the "Schema columns" (e.g., \`ac_month_date\`, \`ac_date\`, or similar depending on the dataset). Since columns are stored as TEXT, YOU MUST CAST: \`EXTRACT(YEAR FROM CAST("<actual_date_column>" AS DATE)) = 2025\` or \`to_char(CAST("<actual_date_column>" AS DATE), 'YYYY') = '2025'\`. DO NOT hallucinate column names.
10. NEVER write a generic SELECT statement without joining to the dataset view when checking aggregate conditional data. (E.g. No \`SELECT (SUM(...) FILTER...) - SUM(...)\` without a FROM clause!)
11. CRITICAL COLUMN MAPPING: The formulas in METRICS below use FRIENDLY names (e.g., 'Gross Incurred Claim'). YOU MUST map these friendly names to the EXACT database column names provided in the 'Schema columns' list (e.g., 'gic'). DO NOT use the friendly names directly in your SQL!
12. DATA FILTERING: For agent-related queries ONLY (e.g., extracting or grouping by 'agent_name' or 'agent_no'), append \`WHERE src <> 'JRNL'\`. For ALL OTHER general and overall business queries (like grouping by 'lob', 'year', 'branch'), DO NOT exclude anything. You MUST include all 'src' types to match system dashboards.
13. PREVENTING NEGATIVE/ZERO PREMIUMS: For any ratio metric or ranking involving premiums (like Retention Ratio), you MUST append a \`HAVING SUM(denominator) > 0 AND SUM(numerator) > 0\` clause to filter out entities with negative or zero premium totals.
14. TIME COMPARISONS: When asked to compare metrics across different years, DO NOT group by year putting years in rows. Instead, use conditional aggregation to put them side-by-side as columns. Example: \`SUM(COALESCE(CAST(gwp AS NUMERIC), 0)) FILTER (WHERE EXTRACT(YEAR FROM CAST(actual_date_column AS DATE)) = 2024) AS gwp_2024\`.
16. ALWAYS sort results (ORDER BY priority): NEVER order by standard text columns unless specifically asked for alphabetical order. YOU MUST ORDER BY THE HIGHEST AGGREGATED METRIC ALIAS DESCENDING. Example: If returning \`lob, SUM(gwp) FILTER(...) AS gwp_2024, SUM(gwp) FILTER(...) AS gwp_2025\`, you MUST end the query with \`ORDER BY gwp_2025 DESC NULLS LAST\` (sort by the newest/highest metric). Do NOT default to \`ORDER BY lob DESC\`.
17. VISUALIZATION (CRITICAL): Always suggest a chart unless the result is a single number. For time series, use 'line'. For categorical comparisons, use 'bar'. For part-to-whole, use 'pie'. Default to 'bar'.
18. TEXT FORMATTING: In your 'explanation', always format numbers over 1000 with commas and prefix currency with 'RM'. Ensure ratios are shown as percentages with 2 decimals.
19. POSTGRES TYPE CONVERSION: Remember that SUM and other aggregates on NUMERIC columns return values that should be handled as floating point numbers in the app. Ensure your SQL doesn't do unnecessary integer truncation.
20. FOLLOW-UP QUESTIONS: You MUST ONLY suggest follow-up questions that can be answered using the "Schema columns" in Rule 2. DO NOT suggest comparisons, groupings, or filters for data points that are not present in this dataset. (e.g., No "branch" questions if "branch" is not in Schema).

JSON Schema: { "sql_query": "SELECT ...", "suggested_chart": "bar|line|pie|none", "follow_up_questions": ["q1","q2"] }`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                ...messages
            ],
            response_format: { type: 'json_object' }
        });

        const responseContent = completion.choices[0].message.content;

        if (!responseContent) {
            throw new Error("OpenAI returned an empty response");
        }

        const parsed = JSON.parse(responseContent);

        // Update token usage pre-execution
        if (role !== 'ADMIN' && userQuota) {
            const inputTokens = completion.usage?.prompt_tokens || 0;
            const outputTokens = completion.usage?.completion_tokens || 0;
            const totalTokens = inputTokens + outputTokens;

            await pool.query(
                'UPDATE User_Quotas SET tokens_used = tokens_used + $1 WHERE user_id::text = $2',
                [totalTokens, userId]
            );

            await pool.query(
                'INSERT INTO Token_Usage (user_id, input_tokens, output_tokens, total_tokens, endpoint) VALUES ($1::uuid, $2, $3, $4, $5)',
                [userId, inputTokens, outputTokens, totalTokens, '/api/generate-query']
            );
        }

        const finalPayload = {
            ...parsed,
            usage: completion.usage
        };

        // Cache successful response memory
        sqlCache.set(cacheKey, finalPayload);

        return NextResponse.json(finalPayload);

    } catch (error: any) {
        console.error('AI Query Generation Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to generate query' }, { status: 500 });
    }
}
