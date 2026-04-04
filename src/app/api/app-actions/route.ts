import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function GET() {
    try {
        const pool = (await import('@/lib/db')).default;

        const appActionsRes = await pool.query('SELECT * FROM User_App_Actions');
        const actionsRes = await pool.query('SELECT * FROM Actions ORDER BY action_name ASC');

        return NextResponse.json({
            appActions: appActionsRes.rows,
            actions: actionsRes.rows
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { entity_type, entity_id, dataset_id, action_id, assigned } = body;

        if (!entity_id || !dataset_id || !action_id) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const pool = (await import('@/lib/db')).default;
        
        // Fetch action name for business logic
        const actRes = await pool.query('SELECT action_name FROM Actions WHERE action_id = $1', [action_id]);
        const actionName = actRes.rows[0]?.action_name;
        
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const idCol = entity_type === 'user' ? 'user_id' : 'group_id';

            // 1. Remove exact existing mapping first
            await client.query(
                `DELETE FROM User_App_Actions WHERE dataset_id = $1 AND action_id = $2 AND ${idCol} = $3`,
                [dataset_id, action_id, entity_id]
            );

            if (assigned) {
                // 2. Logic to prevent "Hidden" from overlapping with "View"/"Download"/"Create"
                if (actionName === 'Hidden') {
                    // If setting to Hidden, purge all other action permissions for this dataset and entity
                    await client.query(
                        `DELETE FROM User_App_Actions WHERE dataset_id = $1 AND ${idCol} = $2`,
                        [dataset_id, entity_id]
                    );
                } else {
                    // If setting to View/Download, we must remove "Hidden" if it exists
                    await client.query(
                        `DELETE FROM User_App_Actions 
                         WHERE dataset_id = $1 AND ${idCol} = $2 
                         AND action_id IN (SELECT action_id FROM Actions WHERE action_name = 'Hidden')`,
                        [dataset_id, entity_id]
                    );
                }

                // 3. Insert new App Action mapping
                await client.query(
                    `INSERT INTO User_App_Actions (app_action_id, ${idCol}, dataset_id, action_id) VALUES (gen_random_uuid(), $1, $2, $3)`,
                    [entity_id, dataset_id, action_id]
                );
            }
            
            await client.query('COMMIT');
        } catch (e) {
            await client.query('ROLLBACK');
            throw e;
        } finally {
            client.release();
        }

        return NextResponse.json({ message: 'User App Actions updated successfully.' }, { status: 200 });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
