import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';
import crypto from 'crypto';

export async function GET() {
    try {
        const db = getDb();
        const sortedGroups = [...db.Groups].sort((a: any, b: any) => a.group_name.localeCompare(b.group_name));
        return NextResponse.json({ data: sortedGroups });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { group_name, description } = body;

        if (!group_name) {
            return NextResponse.json({ error: 'Group name is required' }, { status: 400 });
        }

        const db = getDb();
        const newGroup = {
            group_id: crypto.randomUUID(),
            group_name,
            description: description || null,
            created_at: new Date().toISOString()
        };

        db.Groups.push(newGroup);
        saveDb(db);

        return NextResponse.json({ data: newGroup, message: 'Group created' }, { status: 201 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PUT(request: Request) {
    try {
        const body = await request.json();
        const { group_id, group_name, description } = body;

        if (!group_id || !group_name) {
            return NextResponse.json({ error: 'Group ID and Group Name are required' }, { status: 400 });
        }

        const db = getDb();
        const groupIndex = db.Groups.findIndex((g: any) => g.group_id === group_id);

        if (groupIndex === -1) {
            return NextResponse.json({ error: 'Group not found' }, { status: 404 });
        }

        db.Groups[groupIndex] = {
            ...db.Groups[groupIndex],
            group_name,
            description: description || null
        };
        saveDb(db);

        return NextResponse.json({ data: db.Groups[groupIndex], message: 'Group updated' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
