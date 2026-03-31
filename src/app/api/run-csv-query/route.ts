export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import { cookies } from 'next/headers';
import path from 'path';
import { getDb, saveDb } from '@/lib/json-db';
import { promises as fs } from 'fs';

function runQuery(query: string, conn: any): Promise<any[]> {
    return new Promise((resolve, reject) => {
        conn.all(query, (err: any, res: any) => {
            if (err) {
                reject(err);
            } else {
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

    const accessElements = dbJson.Access_Elements.reduce(
        (acc: Record<string, string>, e: any) => {
            acc[e.element_id] = e.generic_column_name;
            return acc;
        },
        {}
    );

    return rowFilters
        .map((f: any) => ({
            ...f,
            column_name: accessElements[f.element_id]
        }))
        .filter((f: any) => f.column_name);
}

async function buildDuckDBViewQuery(
    filters: any[],
    csvPath: string,
    conn: any
): Promise<string> {

    let query =
        `SELECT * FROM read_csv_auto('${csvPath}', ignore_errors=true, null_padding=true, parallel=false)`;

    if (filters && filters.length > 0) {

        let existingColumns: string[] = [];

        try {
            const schemaQuery =
                `DESCRIBE SELECT * FROM read_csv_auto('${csvPath}', ignore_errors=true, null_padding=true, parallel=false) LIMIT 1`;

            const schemaRes = await runQuery(schemaQuery, conn);

            existingColumns =
                schemaRes.map((row: any) =>
                    row.column_name.toLowerCase()
                );

        } catch (e) {
            console.error("Schema read failed", e);
        }

        const validFilters =
            filters.filter((f: any) =>
                existingColumns.includes(
                    f.column_name.toLowerCase()
                )
            );

        if (validFilters.length > 0) {

            const clauses =
                validFilters.map((f: any) => {

                    const op =
                        f.operator === '='
                            ? '='
                            : (f.operator === '!=' || f.operator === '<>')
                                ? '!='
                                : '=';

                    let val =
                        String(f.element_value)
                            .replace(/'/g, "''");

                    return `lower(${f.column_name}) ${op} lower('${val}')`;
                });

            query +=
                ` WHERE ${clauses.join(' AND ')}`;
        }
    }

    return query;
}

export async function POST(req: NextRequest) {

    let duckdb: any;
    let db: any = null;
    let conn: any = null;

    try {

        // 🔥 Load DuckDB ONLY at runtime
        duckdb = require("duckdb");

        const { sql_query, question, datasetId } =
            await req.json();

        if (!sql_query || !datasetId) {
            return NextResponse.json(
                { error: 'SQL Query and datasetId required' },
                { status: 400 }
            );
        }

        const cookieStore = await cookies();

        const userId =
            cookieStore.get('user_id')?.value;

        const role =
            cookieStore.get('role')?.value || 'USER';

        if (!userId) {
            return NextResponse.json(
                { error: 'Unauthorized' },
                { status: 403 }
            );
        }

        const dbJson = getDb();

        const startTime = Date.now();

        // Load dataset metadata
        const datasetPath =
            path.join(process.cwd(), 'data', 'datasets.json');

        let datasets: any[] = [];

        try {
            const raw =
                await fs.readFile(datasetPath, 'utf8');

            datasets =
                JSON.parse(raw);

        } catch (e) {
            console.error("Dataset read error", e);
        }

        const dataset =
            datasets.find((d: any) =>
                d.id === datasetId
            );

        if (!dataset || !dataset.filePath) {

            return NextResponse.json(
                { error: 'Dataset not found' },
                { status: 404 }
            );
        }

        if (!dataset.aiEnabled) {

            return NextResponse.json(
                { error: 'Dataset not AI enabled' },
                { status: 403 }
            );
        }

        const filters =
            await getUserAccessFilters(
                userId,
                role
            );

        const viewName = 'dataset_view';

        db =
            new duckdb.Database(':memory:');

        conn =
            db.connect();

        const normalizedPath =
            dataset.filePath
                .split('\\')
                .join('/');

        const viewSQL =
            await buildDuckDBViewQuery(
                filters,
                normalizedPath,
                conn
            );

        await runQuery(
            `CREATE OR REPLACE VIEW ${viewName} AS ${viewSQL}`,
            conn
        );

        // Execute SQL

        let df: any[] = [];

        try {

            console.log(
                "Executing SQL:",
                sql_query
            );

            // safe Vercel temp logging
            await fs.appendFile(
                '/tmp/duckdb-debug.log',
                `[RUN] ${sql_query}\n`
            ).catch(() => { });

            df =
                await runQuery(
                    sql_query,
                    conn
                );

        } catch (e: any) {

            console.error("SQL Error:", e);

            await fs.appendFile(
                '/tmp/duckdb-debug.log',
                `[ERR] ${e.message}\n`
            ).catch(() => { });

            return NextResponse.json(
                { error: e.message },
                { status: 500 }
            );
        }

        const executionTime =
            Date.now() - startTime;

        // 🔥 AI Insight Generation

        let insights =
            "Here is the data visualization.";

        let recommendation = "";

        try {

            const openai =
                new OpenAI({
                    apiKey:
                        process.env.OPENAI_API_KEY
                });

            const safeSample =
                df.slice(0, 5);

            const prompt =
                `User Question: ${question}\nData Sample:\n${JSON.stringify(safeSample)}\n\nReturn JSON with explanation and recommendation.`;

            const response =
                await openai.chat.completions.create({

                    model: "gpt-4o-mini",

                    temperature: 0.3,

                    messages: [
                        {
                            role: "user",
                            content: prompt
                        }
                    ],

                    response_format: {
                        type: "json_object"
                    }
                });

            if (
                response.choices[0].message.content
            ) {

                const parsed =
                    JSON.parse(
                        response.choices[0].message.content
                    );

                insights =
                    parsed.explanation || insights;

                recommendation =
                    parsed.recommendation || "";
            }

        } catch (e) {

            console.error(
                "Insight generation error:",
                e
            );
        }

        saveDb(dbJson);

        return NextResponse.json({

            explanation: insights,

            recommendation: recommendation,

            df: df,

            execution_time_ms:
                executionTime,

            filters_applied:
                filters

        });

    } catch (error: any) {

        console.error(
            "API Error:",
            error
        );

        return NextResponse.json(
            {
                error:
                    error.message ||
                    "Server error"
            },
            { status: 500 }
        );

    } finally {

        if (conn) {
            try {
                conn.close();
            } catch { }
        }

        if (db) {
            try {
                db.close();
            } catch { }
        }
    }
}