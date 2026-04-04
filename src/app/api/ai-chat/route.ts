import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import * as xlsx from 'xlsx';
import path from 'path';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
import NodeCache from 'node-cache';
import * as nodeFs from 'fs';
import { getWorkingDatasetTable } from '@/lib/dataset-utils';

// Global cache for HMR dev environments
const globalForCache = globalThis as unknown as {
  duckdbChatCache: NodeCache | undefined
};
const chatCache = globalForCache.duckdbChatCache || new NodeCache({ stdTTL: 3600, checkperiod: 120 });
if (process.env.NODE_ENV !== "production") globalForCache.duckdbChatCache = chatCache;

let cachedContext = '';

function getKnowledgeBaseContext() {
  if (cachedContext) return cachedContext;

  try {
    const filePath = path.join(process.cwd(), 'public', 'data-download', 'PIB Knowledge Bank.xlsx');

    if (!nodeFs.existsSync(filePath)) {
      console.error('Excel file not found at:', filePath);
      return '';
    }

    const workbook = xlsx.readFile(filePath);
    let contextBuilder = '### KNOWLEDGE BASE DATA ###\n\n';

    // Parse PIB Data (Dashboards)
    const pibSheet = workbook.Sheets['PIB Data'];
    if (pibSheet) {
      const dashboards = xlsx.utils.sheet_to_json<any>(pibSheet, { raw: false });

      const uniqueItems = new Map<string, any>();
      dashboards.forEach(row => {
        const dashName = row['Dashboard Name'];
        const dashUrl = row['Dashboard URL'];
        const dashDesc = row['Dashboard Description'];
        if (dashName && dashUrl && !uniqueItems.has(dashName)) {
          uniqueItems.set(dashName, { name: dashName, url: dashUrl, desc: dashDesc, type: 'Dashboard' });
        }

        const viewNameKey = Object.keys(row).find(k => k.startsWith('View Name'));
        const viewName = viewNameKey ? row[viewNameKey] : null;
        const viewUrl = row['View URL'];
        const viewDesc = row['View Description'];
        if (viewName && viewUrl && !uniqueItems.has(viewName)) {
          uniqueItems.set(viewName, { name: dashName ? `${dashName} - ${viewName}` : viewName, url: viewUrl, desc: viewDesc, type: 'View' });
        }
      });

      contextBuilder += '--- Dashboards & Views ---\n';
      Array.from(uniqueItems.values()).forEach((item, idx) => {
        contextBuilder += `[${idx + 1}] Type: ${item.type} | Name: ${item.name} | URL: ${item.url} | Desc: ${item.desc}\n`;
      });
      contextBuilder += '\n';
    }

    // Parse Formulas
    const formulaSheet = workbook.Sheets['Formula'];
    if (formulaSheet) {
      const formulas = xlsx.utils.sheet_to_json<any>(formulaSheet);
      contextBuilder += '--- Metrics & Formulas ---\n';
      formulas.forEach((row) => {
        contextBuilder += `- ${row['Calculations '] || row['Calculations'] || row['Metric']}: ${row['Formula'] || row['Formula ']}\n`;
      });
    }

    cachedContext = contextBuilder;
    return cachedContext;

  } catch (err) {
    console.error('Error parsing Knowledge Bank Excel:', err);
    return '';
  }
}

async function getUserAccessFilters() {
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value || 'USER';
  const userId = cookieStore.get('user_id')?.value;

  if (role === 'ADMIN') return [];
  if (!userId) return null;

  try {
    // Fetch user groups
    const groupRes = await pool.query('SELECT group_id FROM User_Group WHERE user_id::text = $1', [userId]);
    const userGroupIds = groupRes.rows.map((r: any) => r.group_id);

    if (userGroupIds.length === 0) return [];

    // Fetch row filters for these groups
    const filterRes = await pool.query(`
      SELECT f.*, e.generic_column_name as column_name
      FROM User_Access_Filter f
      JOIN Access_Elements e ON f.element_id = e.element_id
      WHERE f.group_id = ANY($1::uuid[])
    `, [userGroupIds]);

    return filterRes.rows;
  } catch (err) {
    console.error("Error fetching user access filters for AI Chat:", err);
    return [];
  }
}

export async function POST(req: NextRequest) {
  try {
    const { messages, datasetId } = await req.json();

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'Messages are required' }, { status: 400 });
    }

    if (!datasetId) {
      return NextResponse.json({ error: 'datasetId is required. No dataset selected.' }, { status: 400 });
    }

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured. Please set OPENAI_API_KEY in your environment.' }, { status: 500 });
    }

    const lastUserMessage = [...messages].reverse().find((m: any) => m.role === 'user')?.content || '';

    // Check Global Cache
    const cacheKey = `chat_${datasetId}_${Buffer.from(lastUserMessage.toLowerCase()).toString('base64').substring(0, 64)}`;
    if (chatCache.has(cacheKey)) {
      console.log("CACHE HIT: Serving cached global chat generation for:", lastUserMessage);
      const cachedPayload = chatCache.get(cacheKey) as any;
      return NextResponse.json({ ...cachedPayload, cached: true });
    }

    // Get or create the PostgreSQL table and associated pool for this dataset
    let tableName: string;
    let dsPool: any;
    let dataset: any = null;
    try {
      const result = await getWorkingDatasetTable(datasetId);
      tableName = result.tableName;
      dsPool = result.pool;
      
      const dsRes = await pool.query('SELECT columns_json FROM Dataset WHERE dataset_id = $1', [datasetId]);
      dataset = { columns: dsRes.rows[0]?.columns_json || [] };
    } catch (e: any) {
      return NextResponse.json({ error: e.message || 'Dataset synchronization failed.' }, { status: 500 });
    }

    const openai = new OpenAI({ apiKey });
    const kbContext = getKnowledgeBaseContext();

    const filters = await getUserAccessFilters();
    if (filters === null) {
      return NextResponse.json({ error: 'Unauthorized to view data. No user_id found.' }, { status: 403 });
    }

    // Load dynamic metrics
    let activeMetrics: any[] = [];
    let metricRules = '';
    try {
      const metricsPath = path.join(process.cwd(), 'data', 'ai-metrics.json');
      const normPath = path.join(process.cwd(), 'data', 'ai-column-aliases.json');
      activeMetrics = JSON.parse(nodeFs.readFileSync(metricsPath, 'utf8'));
      const normalizations = JSON.parse(nodeFs.readFileSync(normPath, 'utf8'));

      metricRules = activeMetrics.map((m: any) => {
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
    } catch (e) {
      console.warn('Could not load metric definitions or aliases');
    }

    let columnList = 'unknown';
    if (dataset.columns) {
      const availableCols = dataset.columns.filter((c: any) => !c.aiRestricted);
      columnList = availableCols.map((c: any) => `${c.name}${c.description ? ` (${c.description})` : ''}`).join(', ');
    }

    const viewName = 'dataset_view';
    const rowFilters = filters || [];
    let securityWhereClause = '';
    if (rowFilters.length > 0) {
      const clauses = rowFilters.map((f: any, idx: number) => {
        const col = f.column_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        const val = f.element_value.toLowerCase();
        return `LOWER("${col}") ${f.operator === '!=' ? '!=' : '='} '${val.replace(/'/g, "''")}'`;
      });
      securityWhereClause = `WHERE ${clauses.join(' AND ')}`;
    }

    const secureCTE = `WITH ${viewName} AS (SELECT * FROM "${tableName}" ${securityWhereClause})`;

    const systemPrompt = `You are a helpful and professional enterprise AI assistant for a data portal, with strong SQL reasoning skills.
Your primary role is to help users navigate dashboards, metrics, and answer data questions. 

When a user asks about dashboards or definitions, use the Knowledge Base Data below:
${kbContext}

### METRIC CALCULATION DICTIONARY & RULES (CRITICAL):
1. If the user asks for a metric listed below, generate SQL using the formula.
2. The formulas below use FRIENDLY names (e.g. "Gross Incurred Claim"). You MUST map these friendly names to the EXACT database column names found in the "Schema columns" below (e.g. "gic"). DO NOT use the friendly names directly in your SQL!
3. Use the base columns to compute them inside SQL.
4. Use SUM() aggregation where appropriate as defined in the formulas. CRITICAL: Never sum a ratio of rows (e.g., DO NOT use SUM(a / b) * 100). You MUST divide the summed aggregates: (SUM(a) / SUM(b)) * 100.
5. Always return results as percentage when the formula multiplies by 100.
6. Keep the existing database schema unchanged.
7. Before generating SQL, verify that the required columns exist in the dataset schema.
8. If one or more required columns are missing, do NOT generate SQL and DO NOT call the run_analytics_query tool. Instead respond with a clear message telling the user that the metric cannot be calculated because required columns are not available in the dataset.
9. The message should clearly list the missing columns so the user understands what data is required.

Metric Calculation Dictionary:
${metricRules}

### LINK FORMATTING RULES (CRITICAL):
1. ALWAYS format links as Markdown: [Link Text](URL).
2. For Dashboard or View links, you MUST use the EXACT URL provided in the Knowledge Base above without modifying it. Route it via the app's tableau module: [/tableau-dashboards?url=<ENCODED_RAW_URL_FROM_KB>]
   CRITICAL: Encode the EXACT raw URL provided for the Dashboard/View (e.g. keeping '286?:origin=card_share_link'). DO NOT hallucinate dashboard names into the URL slug!
   Example: If the KB URL is https://analytics.pacificinsurance.com.my/#/workbooks/286?:origin=card_share_link, then output: [Dashboard Name](/tableau-dashboards?url=https%3A%2F%2Fanalytics.pacificinsurance.com.my%2F%23%2Fworkbooks%2F286%3F%3Aorigin%3Dcard_share_link)
3. For Jira links, output as standard external links.

---
### ANALYTICS & DATA QUERIES
If the user asks an analytics or data query (e.g., "What is the total?", "Top 5 rows", "Compare data for 2024 vs 2025"), you MUST call the 'run_analytics_query' function to execute SQL against the database. 
DO NOT try to answer data questions without calling the function.

The ONLY table you can query is for analytics is: \`${viewName}\` (it is an already filtered subquery containing the data the user is authorized to see).
EVERY analytics query must contain \`FROM ${viewName}\`. DO NOT use "${tableName}" directly.

Columns available in the dataset schema:
${columnList}

If a metric formula uses columns that are completely absent from this list, they are considered missing. You must NOT generate SQL for these and instead reply directly with the missing columns.

CRITICAL SQL RULES FOR POSTGRESQL:
1. ALWAYS use the required dataset table. EVERY query MUST contain a FROM clause.
2. NEVER hallucinate metrics. If a column is not in schema, it does not exist.
3. Always GROUP BY selected columns.
4. Use conditional aggregation for year comparisons (CASE WHEN year = 2024 THEN value ELSE 0 END).
5. Include numerator and denominator columns for ratios.
6. Use common PostgreSQL date functions like DATE_PART or TO_CHAR if needed.
`;

    const runAnalyticsQuery = {
      type: "function" as const,
      function: {
        name: "run_analytics_query",
        description: "Executes a PostgreSQL SQL query against the dataset table to answer analytics questions and generate charts.",
        parameters: {
          type: "object",
          properties: {
            sql_query: { type: "string", description: "The PostgreSQL SQL query to execute. Must query the table specified." },
            chart_type: { type: "string", enum: ["bar", "line", "pie", "none", "comparison"], description: "The recommended chart type for the data visualization." },
            chart_orientation: { type: "string", enum: ["v", "h"], description: "The orientation of the bar chart (vertical or horizontal)." }
          },
          required: ["sql_query", "chart_type"]
        }
      }
    };

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages
      ],
      tools: [runAnalyticsQuery],
      tool_choice: "auto",
    });

    const responseMessage = completion.choices[0].message;

    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0] as any;
      const args = JSON.parse(toolCall.function.arguments);
      const { sql_query, chart_type, chart_orientation } = args;

      let df: any[] = [];
      let error: any = null;
      try {
        const finalSqlQuery = `${secureCTE} ${sql_query}`;
        console.log("Executing AI PostgreSQL SQL with security CTE:", finalSqlQuery);
        const res = await dsPool.query(finalSqlQuery);
        df = res.rows;
      } catch (e: any) {
        console.error("SQL Error:", e);
        error = e;
      }

      if (error) {
        return NextResponse.json({
          role: 'assistant',
          content: "**SQL Error during execution:** " + (error?.message || String(error))
        });
      }

      const narrationPrompt =
        "Provide a VERY CONCISE analytics insight (2-3 lines max) based on the user's question and this resulting data sample (top 5 rows): " +
        JSON.stringify(df.slice(0, 5)) +
        ". Question: " +
        messages[messages.length - 1].content +
        ". Write ONLY 2-3 business-focused lines. Be direct. DO NOT convert formatting. If it is a ratio, output a raw percentage (e.g. 91%), DO NOT prefix with RM or $ currency as ratios are not financial absolutes.";

      let insights = "Here is the data you requested.";
      let narrationUsage = { total_tokens: 0 };

      try {
        const narrationResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [{ role: "user", content: narrationPrompt }],
          max_tokens: 120,
          temperature: 0.3
        });

        insights = narrationResponse.choices?.[0]?.message?.content || insights;
        narrationUsage = narrationResponse.usage || narrationUsage;
      } catch (e) {
        console.error("Narration generation error:", e);
      }

      const payload = {
        role: 'assistant',
        content: insights,
        has_data: true,
        df: df,
        chart_type: chart_type,
        chart_orientation: chart_orientation || 'v',
        sql_query: sql_query,
        usage: {
          total_tokens: (completion.usage?.total_tokens || 0) + (narrationUsage.total_tokens || 0)
        }
      };

      chatCache.set(cacheKey, payload);
      return NextResponse.json(payload);
    }

    const textPayload = {
      role: 'assistant',
      content: responseMessage.content || "I am unable to assist with that.",
      has_data: false,
      usage: completion.usage
    };
    chatCache.set(cacheKey, textPayload);
    return NextResponse.json(textPayload);

  } catch (error: any) {
    console.error('AI Chat Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to process AI request' }, { status: 500 });
  }
}
