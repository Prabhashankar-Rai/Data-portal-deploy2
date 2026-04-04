import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const role = cookieStore.get('role')?.value || 'USER';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
        }

        const pool = (await import('@/lib/db')).default;

        let query = 'SELECT * FROM Chat_History';
        let vals: any[] = [];

        if (role !== 'ADMIN') {
            query += ' WHERE user_id::text = $1';
            vals = [userId];
        }

        query += ' ORDER BY timestamp DESC';

        const res = await pool.query(query, vals);

        return NextResponse.json({ history: res.rows });

    } catch (error: any) {
        console.error('Chat History Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch chat history.' }, { status: 500 });
    }
}
