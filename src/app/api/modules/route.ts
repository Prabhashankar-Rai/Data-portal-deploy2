import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;
        
        // Fetch all modules from PostgreSQL
        const res = await pool.query('SELECT * FROM Module ORDER BY module_name ASC');
        let modules = res.rows;

        // Auto-seed modules if the table is completely empty (safeguard)
        if (modules.length === 0) {
            const seedModules = [
                ['Dashboard', 'Main dashboard overview'],
                ['AI Chat', 'AI-powered data inquiry'],
                ['Tableau Dashboards', 'Embedded Tableau analytics'],
                ['Data Download', 'Dataset export and preview'],
                ['ETL Reports', 'Data pipeline status']
            ];
            for (const [name, purpose] of seedModules) {
                await pool.query(
                    'INSERT INTO Module (module_id, module_name, module_purpose) VALUES (gen_random_uuid(), $1, $2)',
                    [name, purpose]
                );
            }
            const reRes = await pool.query('SELECT * FROM Module ORDER BY module_name ASC');
            modules = reRes.rows;
        }

        return NextResponse.json({ data: modules });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
