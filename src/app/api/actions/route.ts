import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
    try {
        const db = getDb();

        // Auto-seed actions array
        if (db.Actions.length === 0) {
            db.Actions = [
                { action_id: crypto.randomUUID(), action_name: 'View' },
                { action_id: crypto.randomUUID(), action_name: 'Download' },
                { action_id: crypto.randomUUID(), action_name: 'Create' },
                { action_id: crypto.randomUUID(), action_name: 'Hidden' },
                { action_id: crypto.randomUUID(), action_name: 'AI Chat' },
            ];
            saveDb(db);
        } else {
            let changed = false;
            if (!db.Actions.some((a: any) => a.action_name === 'Hidden')) {
                db.Actions.push({ action_id: crypto.randomUUID(), action_name: 'Hidden' });
                changed = true;
            }
            if (!db.Actions.some((a: any) => a.action_name === 'AI Chat')) {
                db.Actions.push({ action_id: crypto.randomUUID(), action_name: 'AI Chat' });
                changed = true;
            }
            if (changed) saveDb(db);
        }

        return NextResponse.json({ data: db.Actions });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
