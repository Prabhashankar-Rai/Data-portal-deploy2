import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
	try {
        const pool = (await import('@/lib/db')).default;
        const res = await pool.query('SELECT user_id, user_name as username, user_email as email, user_role as role, user_designation as designation, created_at FROM Users ORDER BY user_name ASC');
        return NextResponse.json({ data: res.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { username, email, role, designation } = body;

        if (!username || !email) {
            return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        const res = await pool.query(
            'INSERT INTO Users (user_name, user_email, user_role, user_designation) VALUES ($1, $2, $3, $4) RETURNING user_id, user_name as username, user_email as email, user_role as role, user_designation as designation',
            [username, email, role || 'USER', designation || '']
        );

        return NextResponse.json({ data: res.rows[0], message: 'User created' }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { user_id, username, email, role, designation } = body;

        if (!user_id || !username || !email) {
            return NextResponse.json({ error: 'User ID, Username and email are required' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        const res = await pool.query(
            'UPDATE Users SET user_name = $1, user_email = $2, user_role = $3, user_designation = $4 WHERE user_id = $5 RETURNING user_id, user_name as username, user_email as email, user_role as role, user_designation as designation',
            [username, email, role || 'USER', designation || '', user_id]
        );

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ data: res.rows[0], message: 'User updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const user_id = searchParams.get('user_id');

        if (!user_id) {
            return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        const res = await pool.query('DELETE FROM Users WHERE user_id = $1', [user_id]);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'User deleted successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
