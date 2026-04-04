import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;
        const res = await pool.query('SELECT * FROM User_Access_Filter');
        return NextResponse.json({ data: res.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const pool = (await import('@/lib/db')).default;

        if (body.type === 'filter') {
            const { group_id, element_id, operator, element_value } = body;

            await pool.query(
                'INSERT INTO User_Access_Filter (filter_id, group_id, element_id, operator, element_value) VALUES (gen_random_uuid(), $1, $2, $3, $4)',
                [group_id, element_id, operator, element_value]
            );
        } else if (body.type === 'delete_filter') {
            const { filter_id } = body;
            await pool.query('DELETE FROM User_Access_Filter WHERE filter_id = $1', [filter_id]);
        }

        return NextResponse.json({ message: 'Saved successfully.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
