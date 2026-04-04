import { NextResponse } from 'next/server';
export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;
        const res = await pool.query('SELECT module_access_id as access_id, module_id, group_id, user_id FROM User_Module');
        return NextResponse.json({ data: res.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { type, entity_id, module_id, assigned } = body;

        if (!type || !entity_id || !module_id) {
            return NextResponse.json({ error: 'Missing required mapping parameters.' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;

        if (type === 'user') {
            // Remove existing mapping for this user/module
            await pool.query('DELETE FROM User_Module WHERE user_id = $1 AND module_id = $2', [entity_id, module_id]);
            if (assigned) {
                await pool.query('INSERT INTO User_Module (user_id, module_id) VALUES ($1, $2)', [entity_id, module_id]);
            }
        } else if (type === 'group') {
            // Remove existing mapping for this group/module
            await pool.query('DELETE FROM User_Module WHERE group_id = $1 AND module_id = $2', [entity_id, module_id]);
            if (assigned) {
                await pool.query('INSERT INTO User_Module (group_id, module_id) VALUES ($1, $2)', [entity_id, module_id]);
            }
        }

        return NextResponse.json({ message: 'User Module Access updated.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
