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

        const res = await pool.query('SELECT * FROM User_Quotas WHERE user_id::text = $1', [userId]);
        let quota = res.rows[0];

        if (!quota) {
            quota = { user_id: userId, tokens_used: 0, token_limit: 100000 };
        }

        return NextResponse.json({ quota });

    } catch (error: any) {
        console.error('Token Usage Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch token usage.' }, { status: 500 });
    }
}
