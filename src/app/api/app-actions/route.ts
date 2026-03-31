import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
    try {
        const db = getDb();

        // Auto-seed action types if empty
        if (!db.Actions || db.Actions.length === 0) {
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

        return NextResponse.json({
            appActions: db.User_App_Actions || [],
            actions: db.Actions || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const db = getDb();
        const body = await request.json();
        const { entity_type, entity_id, dataset_id, action_id, assigned } = body;

        if (!db.User_App_Actions) db.User_App_Actions = [];
        let mappings = db.User_App_Actions;

        const actionObj = db.Actions.find((a: any) => a.action_id === action_id);
        const actionName = actionObj ? actionObj.action_name : '';
        const hiddenActionObj = db.Actions.find((a: any) => a.action_name === 'Hidden');

        // Remove exact existing mapping for this combo first
        mappings = mappings.filter((m: any) =>
            !(m.dataset_id === dataset_id && m.action_id === action_id &&
                (entity_type === 'user' ? m.user_id === entity_id : m.group_id === entity_id))
        );

        if (assigned) {
            // Logic to prevent "Hidden" from overlapping with "View"/"Download"/"Create"
            if (actionName === 'Hidden') {
                // If setting to Hidden, purge all other action permissions for this dataset and entity
                mappings = mappings.filter((m: any) =>
                    !(m.dataset_id === dataset_id && 
                      (entity_type === 'user' ? m.user_id === entity_id : m.group_id === entity_id))
                );
            } else if (hiddenActionObj) {
                // If setting to View/Download, we must remove "Hidden" if it exists, otherwise it will still be hidden
                mappings = mappings.filter((m: any) =>
                    !(m.dataset_id === dataset_id && m.action_id === hiddenActionObj.action_id &&
                      (entity_type === 'user' ? m.user_id === entity_id : m.group_id === entity_id))
                );
            }

            mappings.push({
                app_action_id: crypto.randomUUID(),
                user_id: entity_type === 'user' ? entity_id : null,
                group_id: entity_type === 'group' ? entity_id : null,
                dataset_id,
                action_id
            });
        }

        db.User_App_Actions = mappings;
        saveDb(db);

        return NextResponse.json({ message: 'User App Actions updated successfully.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
