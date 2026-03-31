import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { cookies } from 'next/headers';
import path from 'path';
import { getDb, saveDb } from '@/lib/json-db';
import { promises as fs } from 'fs';

const duckdb = eval('require("duckdb")');

function runQuery(query: string, conn: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
        conn.all(query, (err: any, res: any) => {
            if (err) {
                 reject(err);
            } else {
                 // Convert BigInts manually since standard NextResponse.json will fail otherwise
                 const standardizedRes = res.map((row: any) => {
                      const newRow: any = {};
                      for (const key in row) {
                           if (typeof row[key] === 'bigint') {
                                newRow[key] = Number(row[key]);
                           } else {
                                newRow[key] = row[key];
                           }
                      }
                      return newRow;
                 });
                 resolve(standardizedRes);
            }
        });
    });
}

async function getUserAccessFilters(userId: string, role: string) {
    if (role === 'ADMIN') return [];
    
    const dbJson = getDb();
    const userGroupIds = dbJson.User_Groups
      .filter((ug: any) => ug.user_id === userId)
      .map((ug: any) => ug.group_id);
      
    let rowFilters = dbJson.User_Access_Filter.filter((f: any) => 
        userGroupIds.includes(f.group_id)
    );
    
    const accessElements = dbJson.Access_Elements.reduce((acc: Record<string, string>, e: any) => {
        acc[e.element_id] = e.generic_column_name;
        return acc;
    }, {});
    
    return rowFilters.map((f: any) => ({
      ...f,
      column_name: accessElements[f.element_id]
    })).filter((f: any) => f.column_name);
}

async function buildDuckDBViewQuery(filters: any[], csvPath: string, conn: any): Promise<string> {
    let query = `SELECT * FROM read_csv_auto('${csvPath}', ignore_errors=true, null_padding=true, parallel=false)`;
    
    if (filters && filters.length > 0) {
        // First pre-flight the schema to see what columns actually exist in this particular CSV
        let existingColumns: string[] = [];
        try {
            const schemaQuery = `DESCRIBE SELECT * FROM read_csv_auto('${csvPath}', ignore_errors=true, null_padding=true, parallel=false) LIMIT 1`;
            const schemaRes = await runQuery(schemaQuery, conn);
            existingColumns = schemaRes.map(row => row.column_name.toLowerCase());
        } catch (e) {
            console.error("Failed to read CSV schema for RLAS pre-flight", e);
        }

        const validFilters = filters.filter(f => existingColumns.includes(f.column_name.toLowerCase()));

        if (validFilters.length > 0) {
            const clauses = validFilters.map(f => {
                const op = f.operator === '=' ? '=' : (f.operator === '!=' || f.operator === '<>' ? '!=' : '=');
                let val = String(f.element_value).replace(/'/g, "''");
                
                if (f.column_name.toLowerCase() === 'lob' && val.length === 3) {
                    if (op === '=') return `lower(lob) LIKE lower('${val}%')`;
                    else return `lower(lob) NOT LIKE lower('${val}%')`;
                }
                
                return `lower(${f.column_name}) ${op} lower('${val}')`;
            });
            query += ` WHERE ${clauses.join(' AND ')}`;
        }
    }
    
    return query;
}

export async function POST(req: NextRequest) {
    let db: any = null;
    let conn: any = null;
    try {
        const { sql_query, question, datasetId } = await req.json();

        if (!sql_query || !datasetId) {
            return NextResponse.json({ error: 'SQL Query and datasetId are required' }, { status: 400 });
        }

        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const role = cookieStore.get('role')?.value || 'USER';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
        }

        const dbJson = getDb();
        const startTime = Date.now();

        let actualUserId = userId;
        const userRec = dbJson.Users?.find((u: any) => u.email === userId || u.username === userId || u.user_id === userId);
        if (userRec) {
            actualUserId = userRec.user_id;
        }

        // 1. Enforce Row-Level Access Security
        const datasetPath = path.join(process.cwd(), 'data', 'datasets.json');
        let datasets = [];
        try {
            const raw = await fs.readFile(datasetPath, 'utf8');
            datasets = JSON.parse(raw);
        } catch (e) {
            console.error("Error reading datasets", e);
        }

        const dataset = datasets.find((d: any) => d.id === datasetId);
        if (!dataset || !dataset.filePath) {
            return NextResponse.json({ error: 'Dataset not found or missing file path.' }, { status: 404 });
        }
        
        if (!dataset.aiEnabled) {
            return NextResponse.json({ error: 'Dataset is not enabled for AI.' }, { status: 403 });
        }

        const filters = await getUserAccessFilters(actualUserId, role);
        const viewName = 'dataset_view'; // Match the table name instructed to OpenAI
        
        db = new duckdb.Database(':memory:');
        conn = db.connect();
        
        // Normalize path for DuckDB string interpolation mapping windows paths to forwards slashes
        const normalizedPath = dataset.filePath.split('\\').join('/');
        
        const viewCreationSQL = await buildDuckDBViewQuery(filters, normalizedPath, conn);
        await runQuery(`CREATE OR REPLACE VIEW ${viewName} AS ${viewCreationSQL}`, conn);

        // 2. Execute SQL
        let df: any[] = [];
        try {
            console.log("Executing SQL over CSV:", sql_query);
            fs.appendFile('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/duckdb-debug.log', `[RUN] ${sql_query}\n`).catch(()=>{});
            df = await runQuery(sql_query, conn);
        } catch (e: any) {
            console.error("SQL Error:", e);
            fs.appendFile('C:/Users/PrabhashankarRai/Downloads/Enterprise-Portal-2026-main/Enterprise-Portal-2026-main/duckdb-debug.log', `[ERR] ${e.message}\n`).catch(()=>{});
            return NextResponse.json({ error: `SQL Execution Error: ${e.message}` }, { status: 500 });
        }

        const executionTime = Date.now() - startTime;

        // 3. Generate Narrated Insights (Explanation + Recommendation)
        const apiKey = process.env.OPENAI_API_KEY;
        const openai = new OpenAI({ apiKey });
        
        let insights = "Here is the data visualization.";
        let recommendation = "";
        let inputTokens = 0, outputTokens = 0;

        try {
            // Protect restricted columns from AI explanation process by aliasing them
            const restrictedColumns = dataset.columns?.filter((c: any) => c.aiRestricted).map((c: any) => c.name.toLowerCase()) || [];
            
            const aliasMaps: Record<string, Map<any, string>> = {};
            const aliasCounters: Record<string, number> = {};

            const safeDfSample = df.slice(0, 5).map((row: any) => {
                 const safeRow = { ...row };
                 for (const key of Object.keys(safeRow)) {
                      const lowerKey = key.toLowerCase();
                      if (restrictedColumns.includes(lowerKey)) {
                           if (!aliasMaps[lowerKey]) {
                                aliasMaps[lowerKey] = new Map();
                                aliasCounters[lowerKey] = 1;
                           }
                           
                           const originalValue = safeRow[key];
                           if (originalValue !== null && originalValue !== undefined) {
                               if (!aliasMaps[lowerKey].has(originalValue)) {
                                   aliasMaps[lowerKey].set(originalValue, `Entity ${aliasCounters[lowerKey]++}`);
                               }
                               safeRow[key] = aliasMaps[lowerKey].get(originalValue);
                           }
                      }
                 }
                 return safeRow;
            });

            const prompt = `You are a production-grade Insurance AI Expert analyzing CSV data.\nUser Asked: ${question || 'Unknown User Question'}\nRaw SQL Executed: ${sql_query}\nData Sample (First 5 Rows): ${JSON.stringify(safeDfSample, (key, value) => typeof value === 'bigint' ? value.toString() : value)}\n\nWrite a strict JSON containing two strings:\n{ \n  "explanation": "2-3 short, clear sentences explaining the analytical insights gained, citing top numbers if applicable. For monetary values ALWAYS use 'RM ' as the currency symbol (e.g. RM 50,000), but for ratios, rates, or percentages, use '%'. NEVER use '$' or '₹'.",\n  "recommendation": "1-2 brief business recommendations based strictly on the trends visible."\n}`;
            const insightResponse = await openai.chat.completions.create({
                model: 'gpt-4o',
                temperature: 0.3,
                messages: [{ role: 'user', content: prompt }],
                response_format: { type: 'json_object' }
            });

            if (insightResponse.choices[0].message.content) {
                const parsed = JSON.parse(insightResponse.choices[0].message.content);
                insights = parsed.explanation || insights;
                recommendation = parsed.recommendation || recommendation;
            }
            
            inputTokens = insightResponse.usage?.prompt_tokens || 0;
            outputTokens = insightResponse.usage?.completion_tokens || 0;
        } catch (e) {
            console.error("Narration error:", e);
        }
        
        const totalTokens = inputTokens + outputTokens;

        // 4. Update Token Quota
        if (!dbJson.User_Quotas) dbJson.User_Quotas = [];
        let userQuota = dbJson.User_Quotas.find((q: any) => q.user_id === actualUserId);
        if (userQuota && role !== 'ADMIN') {
             userQuota.tokens_used += totalTokens;
             
             if (!dbJson.Token_Usage) dbJson.Token_Usage = [];
             dbJson.Token_Usage.push({
                  user_id: actualUserId,
                  timestamp: new Date().toISOString(),
                  input_tokens: inputTokens,
                  output_tokens: outputTokens,
                  total_tokens: totalTokens,
                  endpoint: '/api/run-csv-query'
             });
        }

        // 5. Audit Logging
        if (!dbJson.Audit_Log) dbJson.Audit_Log = [];
        dbJson.Audit_Log.push({
             user_id: actualUserId,
             question: question || '',
             generated_query: sql_query,
             filters_applied: JSON.stringify(filters),
             execution_timestamp: new Date().toISOString()
        });
        
        // 6. Chat History Logging
        if (!dbJson.Chat_History) dbJson.Chat_History = [];
        dbJson.Chat_History.push({
             user_id: actualUserId,
             timestamp: new Date().toISOString(),
             user_question: question || '',
             generated_query: sql_query,
             execution_time: executionTime,
             tokens_used: totalTokens,
             ai_response: insights,
             ai_recommendation: recommendation
        });
        
        saveDb(dbJson);

        return NextResponse.json({
            explanation: insights,
            recommendation: recommendation,
            df: df,
            tokens_used: totalTokens,
            execution_time_ms: executionTime,
            filters_applied: filters
        });

    } catch (error: any) {
        console.error('AI CSV Query Error:', error);
        return NextResponse.json({ error: error.message || 'Failed to process CSV request' }, { status: 500 });
    } finally {
        if (conn) {
            try {
                conn.close();
            } catch (e) {
                console.error("Failed closing DuckDB connection", e);
            }
        }
        if (db) {
            try {
                db.close();
            } catch (e) {
                console.error("Failed closing DuckDB database", e);
            }
        }
    }
}
