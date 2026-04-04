import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { cookies } from 'next/headers';
import { getWorkingDatasetTable } from '@/lib/dataset-utils';

export async function POST(req: NextRequest) {
    try {
        const { sql_query, question, datasetId } = await req.json();

        if (!sql_query || !datasetId) {
            return NextResponse.json(
                { error: 'SQL Query and datasetId required' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const role = cookieStore.get('role')?.value || 'USER';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // Get or create the PostgreSQL table and associated pool for this dataset
        let tableName: string;
        let dsPool: any; // Use the pool returned by the utility
        try {
            const result = await getWorkingDatasetTable(datasetId);
            tableName = result.tableName;
            dsPool = result.pool;
        } catch (e: any) {
            return NextResponse.json({ error: e.message || 'Dataset synchronization failed' }, { status: 500 });
        }

        const startTime = Date.now();

        // 1. Map 'dataset_view' to the real table name in the query
        // The table name is quoted to handle any PostgreSQL-specific case sensitivity
        // We use a regex that handles both "dataset_view" and dataset_view to avoid double-quoting
        let finalQuery = sql_query.replace(/"?dataset_view"?/gi, `"${tableName}"`);

        // Execute SQL on the correct PostgreSQL pool
        let df: any[] = [];
        try {
            console.log("Executing PostgreSQL SQL on selected pool:", finalQuery);
            const res = await dsPool.query(finalQuery);
            df = res.rows;
        } catch (e: any) {
            console.error("PostgreSQL Query Error:", e);
            return NextResponse.json({ error: e.message }, { status: 500 });
        }

        const executionTime = Date.now() - startTime;

        // 2. AI Insight Generation
        let insights = "Here is the data visualization.";
        let recommendation = "";

        try {
            const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
            const safeSample = df.slice(0, 5);
            const prompt = `Concise Business Analyst. Analyze data for: "${question}".
Sample: ${JSON.stringify(safeSample)}
Format: Markdown executive summary (bold keys, bullet trends) + 1-2 strategies. 
Rules: No raw JSON/tech jargon. Currency: RM 1,234.56.
JSON response: { "explanation": "md", "recommendation": "md" }`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o-mini",
                temperature: 0.1,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            if (response.choices[0].message.content) {
                const parsed = JSON.parse(response.choices[0].message.content);
                
                // Ensure insights and recommendation are strings to prevent React rendering errors
                if (parsed.explanation) {
                    insights = typeof parsed.explanation === 'object' 
                        ? JSON.stringify(parsed.explanation) 
                        : String(parsed.explanation);
                }
                
                if (parsed.recommendation) {
                    recommendation = typeof parsed.recommendation === 'object' 
                        ? JSON.stringify(parsed.recommendation) 
                        : String(parsed.recommendation);
                }
            }
        } catch (e) {
            console.error("Insight generation error:", e);
        }

        return NextResponse.json({
            explanation: insights,
            recommendation: recommendation,
            df: df,
            execution_time_ms: executionTime,
            filters_applied: [] 
        });

    } catch (error: any) {
        console.error("API Error:", error);
        return NextResponse.json({ error: error.message || "Server error" }, { status: 500 });
    }
}