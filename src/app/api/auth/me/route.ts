import { NextResponse } from 'next/server';
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

        if (!userId) {
            return NextResponse.json({ authenticated: false }, { status: 401 });
        }

        const pool = (await import('@/lib/db')).default;

        // Fetch user from PG
        const userRes = await pool.query('SELECT * FROM Users WHERE user_id::text = $1 OR user_email = $1', [userId]);
        const user = userRes.rows[0];

        if (!user) {
            return NextResponse.json({ authenticated: false, error: 'User not found in database' }, { status: 401 });
        }

        const currentRole = user.user_role || 'USER';
        let authorizedModules: string[] = [];

        if (currentRole === 'ADMIN') {
            // Admin sees all modules
            const modRes = await pool.query('SELECT module_name FROM Module');
            authorizedModules = modRes.rows.map((m: any) => m.module_name);
        } else {
            // Find module names user has access to via their groups or direct assignment
            const accessRes = await pool.query(`
                SELECT DISTINCT m.module_name
                FROM Module m
                JOIN User_Module um ON m.module_id = um.module_id
                LEFT JOIN User_Group ug ON um.group_id = ug.group_id
                WHERE ug.user_id = $1 OR um.user_id = $1
            `, [user.user_id]);

            authorizedModules = accessRes.rows.map((r: any) => r.module_name);
        }

        const response = NextResponse.json({
            authenticated: true,
            role: currentRole,
            userId: user.user_id,
            email: user.user_email,
            username: user.user_name,
            authorizedModules
        }, { status: 200 });

        // -- AUTO-SYNC COOKIES --
        // If cookies are stale, update them to match the database
        const cookieOptions = { path: '/', httpOnly: false, secure: process.env.NODE_ENV === 'production' };
        if (role !== currentRole) {
            response.cookies.set('role', currentRole, cookieOptions);
        }
        if (userId !== user.user_id) {
            response.cookies.set('user_id', user.user_id, cookieOptions);
        }
        if (username !== user.user_name) {
            response.cookies.set('username', user.user_name, cookieOptions);
        }

        return response;
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
