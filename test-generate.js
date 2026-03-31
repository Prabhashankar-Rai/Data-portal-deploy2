const OpenAI = require('openai');
require('dotenv').config({ path: '.env.local' });
if (!process.env.OPENAI_API_KEY) {
    require('dotenv').config({ path: '.env' });
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function run() {
    const systemPrompt = `You are an Insurance Analytics AI. Target table: \`dataset_view\`. Output JSON strictly.

DuckDB SQL RULES:
1. CRITICAL: The ONLY valid table is \`"dataset_view"\`. NEVER use 'src' or any schema column as the FROM table. EVERY query must contain \`FROM "dataset_view"\`.
2. Schema columns: src,ytd_flag,ac_month_date,child_agent_no,agent_no,introducer_no,agent_type,agent_status,lob,policy_type,product_desc,reporting_branch_name,reporting_line,channel,source,agent_start_date,agent_end_date,piam_expiry_date,piam_licence_no,new_lost_flag,lob_profit_segment,total_profit_segment,inactive_status,curr_behavioural_segment,sales_group,his_behavioural_segment,rm_no,rm_name,risk_type,sum_insured,gwp_total,gwp,nwp,gep,nep,nop_t,nor_t,nop_total_epr,nor_total_epr,gic,nic,noc,gpd,npd,gos,nos,gross_comm,net_comm
3. Restricted: 
4. ONLY use exact DB column names from Schema above (descriptions in parens are just hints). If asked about Restricted/Missing cols, return exactly: \`SELECT 'Error: The requested column has been restricted by the Administrator for AI analysis.' AS insight;\`
5. Use double quotes for columns (\`"col"\`) and single quotes for strings/dates (\`'2025'\`, \`'%Y'\`).
6. Mathematical columns MUST be cast natively: TRY_CAST("col" AS DOUBLE).
7. Math Safety (CRITICAL): Wrap in COALESCE for nulls, and NULLIF for division by zero. Ex: \`(SUM(COALESCE(TRY_CAST("gic" AS DOUBLE), 0)) / NULLIF(SUM(COALESCE(TRY_CAST("gwp" AS DOUBLE), 0)), 0)) * 100\`
8. Vague Metrics (e.g., "loss ratio"): Infer intent, use METRICS formulas below. Do not reject. Add 2-3 advanced metrics in \`follow_up_questions\`.
9. Date Filtering (CRITICAL): NEVER use \`LIKE\` on a DATE column. To filter by year, dynamically identify the correct date column from the "Schema columns" (e.g., \`ac_month_date\`, \`ac_date\`, or similar depending on the dataset). Then use: \`EXTRACT(YEAR FROM "<actual_date_column>") = 2025\` or \`STRFTIME('%Y', "<actual_date_column>") = '2025'\`. DO NOT hallucinate column names.
10. NEVER write a generic SELECT statement without joining to the dataset view when checking aggregate conditional data. (E.g. No \`SELECT (SUM(...) FILTER...) - SUM(...)\` without a FROM clause!)
11. CRITICAL COLUMN MAPPING: The formulas in METRICS below use FRIENDLY names (e.g., 'Gross Incurred Claim'). YOU MUST map these friendly names to the EXACT database column names provided in the 'Schema columns' list (e.g., 'gic'). DO NOT use the friendly names directly in your SQL!

METRICS: 
- Gross Written Premium = SUM(COALESCE(try_cast("gwp" as double), 0))
- Gross Incurred Claim = SUM(COALESCE(try_cast("gic" as double), 0))
- Gross Written Loss Ratio = (SUM(COALESCE(try_cast("gic" as double), 0)) / NULLIF(SUM(COALESCE(try_cast("gwp" as double), 0)), 0)) * 100

JSON Schema: { "sql_query": "SELECT ...", "suggested_chart": "bar|line|pie|none", "follow_up_questions": ["q1","q2"] }`;

    const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: 'give me top 5 agents for fire business in 2025' }
        ],
        response_format: { type: 'json_object' }
    });

    console.log(completion.choices[0].message.content);
}

run().catch(console.error);
