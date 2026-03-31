import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
    try {
        const db = getDb();
        return NextResponse.json({ data: db.User_Access_Filter || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const db = getDb();
        const body = await request.json();

        if (body.type === 'filter') {
            const { group_id, element_id, operator, element_value } = body;

            if (!db.User_Access_Filter) db.User_Access_Filter = [];

            db.User_Access_Filter.push({
                filter_id: crypto.randomUUID(),
                group_id,
                element_id,
                operator,
                element_value
            });
            saveDb(db);
        } else if (body.type === 'delete_filter') {
            const { filter_id } = body;
            db.User_Access_Filter = db.User_Access_Filter.filter((p: any) => p.filter_id !== filter_id);
            saveDb(db);
        }

        return NextResponse.json({ message: 'Saved successfully.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
