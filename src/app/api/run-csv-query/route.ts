import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { cookies } from 'next/headers';
import pool from '@/lib/db';
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

        // Get or create the PostgreSQL table for this dataset
        let tableName: string;
        try {
            tableName = await getWorkingDatasetTable(datasetId);
        } catch (e: any) {
            return NextResponse.json({ error: e.message || 'Dataset synchronization failed' }, { status: 500 });
        }

        const startTime = Date.now();

        // 1. Map 'dataset_view' to the real table name in the query
        // The table name is quoted to handle any PostgreSQL-specific case sensitivity
        let finalQuery = sql_query.replace(/dataset_view/gi, `"${tableName}"`);

        // Execute SQL on PostgreSQL
        let df: any[] = [];
        try {
            console.log("Executing PostgreSQL SQL:", finalQuery);
            const res = await pool.query(finalQuery);
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
            const prompt = `User Question: ${question}\nData Sample:\n${JSON.stringify(safeSample)}\n\nReturn JSON with explanation and recommendation.`;

            const response = await openai.chat.completions.create({
                model: "gpt-4o",
                temperature: 0.3,
                messages: [{ role: "user", content: prompt }],
                response_format: { type: "json_object" }
            });

            if (response.choices[0].message.content) {
                const parsed = JSON.parse(response.choices[0].message.content);
                insights = parsed.explanation || insights;
                recommendation = parsed.recommendation || "";
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