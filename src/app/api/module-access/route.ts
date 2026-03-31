import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
    try {
        const db = getDb();
        return NextResponse.json({ data: db.User_Module_Access || [] });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const db = getDb();
        const body = await request.json();
        const { type, entity_id, module_id, assigned } = body;

        if (!type || !entity_id || !module_id) {
            return NextResponse.json({ error: 'Missing required mapping parameters.' }, { status: 400 });
        }

        if (!db.User_Module_Access) db.User_Module_Access = [];

        let mappings = db.User_Module_Access;

        // Remove existing identical mapping to prevent duplicates
        mappings = mappings.filter((m: any) =>
            !(m.module_id === module_id &&
                (type === 'user' ? m.user_id === entity_id : m.group_id === entity_id))
        );

        // If assigned = true, reconstruct the mapping
        if (assigned) {
            mappings.push({
                access_id: crypto.randomUUID(),
                user_id: type === 'user' ? entity_id : null,
                group_id: type === 'group' ? entity_id : null,
                module_id: module_id
            });
        }

        db.User_Module_Access = mappings;
        saveDb(db);

        return NextResponse.json({ message: 'User Module Access updated.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
