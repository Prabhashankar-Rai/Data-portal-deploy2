import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;
        const res = await pool.query('SELECT group_id, group_name, group_purpose as description, group_email_id as email, created_at FROM Groups ORDER BY group_name ASC');
        return NextResponse.json({ data: res.rows });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { group_name, description, email } = body;

        if (!group_name) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        const res = await pool.query(
            'INSERT INTO Groups (group_name, group_purpose, group_email_id) VALUES ($1, $2, $3) RETURNING group_id, group_name, group_purpose as description, group_email_id as email',
            [group_name, description || '', email || '']
        );

        return NextResponse.json({ data: res.rows[0], message: 'Group created' }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { group_id, group_name, description, email } = body;

        if (!group_id || !group_name) {
            return NextResponse.json({ error: 'Group ID and Group Name are required' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        const res = await pool.query(
            'UPDATE Groups SET group_name = $1, group_purpose = $2, group_email_id = $3 WHERE group_id = $4 RETURNING group_id, group_name, group_purpose as description, group_email_id as email',
            [group_name, description || '', email || '', group_id]
        );

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        return NextResponse.json({ data: res.rows[0], message: 'Group updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const group_id = searchParams.get('group_id');

        if (!group_id) {
            return NextResponse.json({ error: 'Group ID is required' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        const res = await pool.query('DELETE FROM Groups WHERE group_id = $1', [group_id]);

        if (res.rowCount === 0) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        return NextResponse.json({ message: 'Group deleted successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
