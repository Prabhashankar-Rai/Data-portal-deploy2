import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
	try {
		const db = getDb();
		const sortedUsers = [...db.Users].sort((a: any, b: any) => a.username.localeCompare(b.username));
		return NextResponse.json({ data: sortedUsers });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { username, email, role } = body;

		if (!username || !email) {
			return NextResponse.json({ error: 'Username and email are required' }, { status: 400 });
		}

		const db = getDb();
		const newUser = {
			user_id: crypto.randomUUID(), // Automatically created GUID
			username,
			email,
			role: role || 'USER',
			created_at: new Date().toISOString()
		};

		db.Users.push(newUser);
		saveDb(db);

		return NextResponse.json({ data: newUser, message: 'User created' }, { status: 201 });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}

export async function PUT(request: Request) {
	try {
		const body = await request.json();
		const { user_id, username, email, role } = body;

		if (!user_id || !username || !email) {
			return NextResponse.json({ error: 'User ID, Username and email are required' }, { status: 400 });
		}

		const db = getDb();
		const userIndex = db.Users.findIndex((u: any) => u.user_id === user_id);

		if (userIndex === -1) {
			return NextResponse.json({ error: 'User not found' }, { status: 404 });
		}

		db.Users[userIndex] = {
			...db.Users[userIndex],
			username,
			email,
            role: role || db.Users[userIndex].role || 'USER'
		};
		saveDb(db);

		return NextResponse.json({ data: db.Users[userIndex], message: 'User updated' }, { status: 200 });
	} catch (error: any) {
		return NextResponse.json({ error: error.message }, { status: 500 });
	}
}
