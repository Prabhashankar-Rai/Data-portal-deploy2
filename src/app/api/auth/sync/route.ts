import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../[...nextauth]/options';

export async function GET(request: Request) {
    try {
        console.log("\n--- [SYNC] /api/auth/sync reached ---");
        const session = await getServerSession(authOptions);
        console.log("Session fetched:", JSON.stringify(session));

        if (!session || !session.user) {
            // User went here without a valid NextAuth session
            return NextResponse.redirect(new URL('/login?error=SessionExpired', request.url));
        }

        const user = session.user as any;

        // Create the response object that redirects to dashboard
        const response = NextResponse.redirect(new URL('/dashboard', request.url));

        // Inject the legacy cookies
        response.cookies.set('loggedIn', 'true', { path: '/', httpOnly: false, secure: process.env.NODE_ENV === 'production' });
        response.cookies.set('role', user.role || 'USER', { path: '/', httpOnly: false, secure: process.env.NODE_ENV === 'production' });
        response.cookies.set('user_id', user.user_id || user.email, { path: '/', httpOnly: false, secure: process.env.NODE_ENV === 'production' });
        response.cookies.set('username', user.username || user.name || 'Azure User', { path: '/', httpOnly: false, secure: process.env.NODE_ENV === 'production' });

        return response;
    } catch (error: any) {
        console.error('Session Sync Error:', error.message);
        return NextResponse.redirect(new URL('/login?error=SyncFailed', request.url));
    }
}
