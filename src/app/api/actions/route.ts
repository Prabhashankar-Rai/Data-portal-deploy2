import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;
        
        // Fetch all actions from PostgreSQL
        const res = await pool.query('SELECT * FROM Actions ORDER BY action_name ASC');
        let actions = res.rows;

        const mandatoryActions = ['View', 'Download', 'Create', 'Hidden', 'AI Chat'];
        let updated = false;

        for (const actionName of mandatoryActions) {
            if (!actions.some((a: any) => a.action_name === actionName)) {
                await pool.query(
                    'INSERT INTO Actions (action_id, action_name) VALUES (gen_random_uuid(), $1)',
                    [actionName]
                );
                updated = true;
            }
        }

        if (updated) {
            const reRes = await pool.query('SELECT * FROM Actions ORDER BY action_name ASC');
            actions = reRes.rows;
        }

        return NextResponse.json({ data: actions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
