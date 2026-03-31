import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
    try {
        const db = getDb();

        // Clean up Service Desk from DB if it exists
        if (db.Modules.some((m: any) => m.module_name === 'Service Desk')) {
            db.Modules = db.Modules.filter((m: any) => m.module_name !== 'Service Desk');
            // Clean up related access if needed (assuming cascaded elsewhere, or just orphan it)
            db.User_Module_Access = db.User_Module_Access.filter((uma: any) => 
                db.Modules.some((m: any) => m.module_id === uma.module_id)
            );
            saveDb(db);
        }

        // Auto-seed modules if empty since we already have a sidebar
        if (db.Modules.length === 0) {
            db.Modules = [
                { module_id: crypto.randomUUID(), module_name: 'Dashboard' },
                { module_id: crypto.randomUUID(), module_name: 'AI Chat' },
                { module_id: crypto.randomUUID(), module_name: 'Tableau Dashboards' },
                { module_id: crypto.randomUUID(), module_name: 'Data Download' },
                { module_id: crypto.randomUUID(), module_name: 'ETL Reports' }
            ];
            saveDb(db);
        }

        return NextResponse.json({ data: db.Modules });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
