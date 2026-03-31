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
        
        let history = dbJson.Chat_History || [];
        
        // If not admin, only show their own history
        if (role !== 'ADMIN') {
            history = history.filter((h: any) => h.user_id === userId);
        }

        // Sort by timestamp descending
        history.sort((a: any, b: any) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({ history });

    } catch (error: any) {
        console.error('Chat History Fetch Error:', error);
        return NextResponse.json({ error: 'Failed to fetch chat history.' }, { status: 500 });
    }
}
