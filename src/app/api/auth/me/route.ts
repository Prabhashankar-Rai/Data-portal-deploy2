import { NextResponse } from 'next/server';
import { getDb } from '@/lib/json-db';
import { cookies } from 'next/headers';

export async function GET() {
    try {
        const cookieStore = await cookies();
        let role = cookieStore.get('role')?.value || 'USER';
        let userId = cookieStore.get('user_id')?.value;
        const loggedIn = cookieStore.get('loggedIn')?.value;
        let username = cookieStore.get('username')?.value;

        try { if (role) role = decodeURIComponent(role); } catch {}
        try { if (userId) userId = decodeURIComponent(userId); } catch {}
        try { if (username) username = decodeURIComponent(username); } catch {}

        if (!loggedIn) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const db = getDb();

        let authorizedModules: string[] = [];

        if (role === 'ADMIN') {
            // Admin sees all
            authorizedModules = db.Modules.map((m: any) => m.module_name);
        } else if (userId) {
            // Find groups user is a part of
            const userGroupIds = db.User_Groups
                .filter((ug: any) => ug.user_id === userId)
                .map((ug: any) => ug.group_id);

            // Find module IDs assigned to the user or any of their groups
            const assignedModuleIds = db.User_Module_Access
                .filter((m: any) => {
                    return m.user_id === userId || userGroupIds.includes(m.group_id);
                })
                .map((m: any) => m.module_id);

            // Lookup module names
            authorizedModules = db.Modules
                .filter((mod: any) => assignedModuleIds.includes(mod.module_id))
                .map((mod: any) => mod.module_name);
        }

        return NextResponse.json({
            authenticated: true,
            role,
            userId,
            username,
            authorizedModules
        }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
