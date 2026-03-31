import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/json-db';

export async function GET(req: NextRequest) {
    try {
        const cookieStore = await cookies();
        const userId = cookieStore.get('user_id')?.value;
        const role = cookieStore.get('role')?.value || 'USER';

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized.' }, { status: 403 });
        }

        const dbJson = getDb();
        
        let quota = dbJson.User_Quotas?.find((q: any) => q.user_id === userId);

        if (!quota) {
            quota = { user_id: userId, tokens_used: 0, limit: 100000 };
        }

        return NextResponse.json({ quota });

    } catch (error: any) {
        console.error('Token Usage Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch token usage.' }, { status: 500 });
    }
}
