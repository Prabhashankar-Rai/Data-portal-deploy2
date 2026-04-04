import { NextResponse } from 'next/server';

export async function GET(
    request: Request,
    { params }: { params: Promise<{ userId: string }> }
) {
    try {
        const { userId } = await params;
        const pool = (await import('@/lib/db')).default;

        // Fetch groups for user with names
        const res = await pool.query(`
            SELECT ug.group_id, g.group_name 
            FROM User_Group ug
            JOIN Groups g ON ug.group_id = g.group_id
            WHERE ug.user_id = $1
        `, [userId]);

        return NextResponse.json({ data: res.rows }); 
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

        const pool = (await import('@/lib/db')).default;

        // Use a transaction to ensure atomic update
        const client = await pool.connect();
        try {
            await client.query('BEGIN');
            // Clear existing groups for user
            await client.query('DELETE FROM User_Group WHERE user_id = $1', [userId]);

            // Insert new User_Group mappings
            for (const groupId of groupIds) {
                await client.query(
                    'INSERT INTO User_Group (user_id, group_id) VALUES ($1, $2)',
                    [userId, groupId]
                );
            }
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        return NextResponse.json({ message: 'User Groups updated successfully' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
