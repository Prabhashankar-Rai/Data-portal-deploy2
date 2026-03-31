import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/json-db';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;

        const db = getDb();

        // User Group 
        const userGroups = db.User_Groups
            .filter((ug: any) => ug.user_id === userId);

        return NextResponse.json({ data: userGroups }); // Returns mappings representing Group ID and Group Name.
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const { groupIds } = await request.json(); // array of group IDs

        if (!Array.isArray(groupIds)) {
            return NextResponse.json({ error: 'groupIds must be an array' }, { status: 400 });
        }

        const db = getDb();

        // Clear existing groups for user
        db.User_Groups = db.User_Groups.filter((ug: any) => ug.user_id !== userId);

        // Insert new User_Groups
        for (const groupId of groupIds) {
            const g = db.Groups.find((grp: any) => grp.group_id === groupId);
            if (g) {
                db.User_Groups.push({
                    user_id: userId,
                    group_id: groupId,
                    group_name: g.group_name
                });
            }
        }

        saveDb(db);

        return NextResponse.json({ message: 'User Groups updated successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
