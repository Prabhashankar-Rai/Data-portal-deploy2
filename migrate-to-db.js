const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const JSON_FILE = path.join(__dirname, 'data', 'user-management.json');

async function migrate() {
    if (!fs.existsSync(JSON_FILE)) {
        console.error("JSON file not found at:", JSON_FILE);
        return;
    }

    const data = JSON.parse(fs.readFileSync(JSON_FILE, 'utf-8'));
    console.log("Starting migration from JSON to PostgreSQL...");

    try {
        // 1. Actions
        console.log("- Migrating Actions...");
        for (const a of data.Actions || []) {
            await pool.query(
                `INSERT INTO Actions (action_id, action_name) VALUES ($1, $2) ON CONFLICT (action_id) DO NOTHING`,
                [a.action_id, a.action_name]
            );
        }

        // 2. Modules
        console.log("- Migrating Modules...");
        for (const m of data.Modules || []) {
            await pool.query(
                `INSERT INTO Module (module_id, module_name, module_purpose) VALUES ($1, $2, $3) ON CONFLICT (module_id) DO NOTHING`,
                [m.module_id, m.module_name, m.description || '']
            );
        }

        // 3. Users
        console.log("- Migrating Users...");
        for (const u of data.Users || []) {
            await pool.query(
                `INSERT INTO Users (user_id, user_name, user_email, user_designation) VALUES ($1, $2, $3, $4) ON CONFLICT (user_id) DO NOTHING`,
                [u.user_id, u.username, u.email, u.designation || '']
            );
        }

        // 4. Groups
        console.log("- Migrating Groups...");
        for (const g of data.Groups || []) {
            await pool.query(
                `INSERT INTO Groups (group_id, group_name, group_purpose, group_email_id) VALUES ($1, $2, $3, $4) ON CONFLICT (group_id) DO NOTHING`,
                [g.group_id, g.group_name, g.description || '', g.email || '']
            );
        }

        // 5. User_Group (Mappings)
        console.log("- Migrating User_Group mappings...");
        for (const ug of data.User_Groups || []) {
            await pool.query(
                `INSERT INTO User_Group (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [ug.group_id, ug.user_id]
            );
        }

        // 6. Access Elements
        console.log("- Migrating Access_Elements...");
        for (const e of data.Access_Elements || []) {
            await pool.query(
                `INSERT INTO Access_Elements (element_id, element_name, element_datatype, generic_column_name) VALUES ($1, $2, $3, $4) ON CONFLICT (element_id) DO NOTHING`,
                [e.element_id, e.element_name, e.element_datatype, e.generic_column_name]
            );
        }

        // 7. User_Access_Filter
        console.log("- Migrating User_Access_Filter...");
        for (const f of data.User_Access_Filter || []) {
            await pool.query(
                `INSERT INTO User_Access_Filter (filter_id, group_id, element_id, operator, element_value) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (filter_id) DO NOTHING`,
                [f.filter_id, f.group_id, f.element_id, f.operator, f.element_value]
            );
        }

        // 8. Dataset (Self-derived if missing from JSON Datasets array)
        const datasetIds = [...new Set((data.User_App_Actions || []).map(uaa => uaa.dataset_id))];
        console.log("- Migrating Dataset records...");
        for (const dsId of datasetIds) {
            await pool.query(
                `INSERT INTO Dataset (dataset_id, dataset_name, dataset_label, dataset_type) VALUES ($1, $2, $3, $4) ON CONFLICT (dataset_id) DO NOTHING`,
                [dsId, dsId, dsId, 'WAREHOUSE']
            );
        }

        // 9. User_Module_Access (Module Access)
        console.log("- Recreating User_Module table and migrating module access...");
        await pool.query(`DROP TABLE IF EXISTS User_Module`);
        await pool.query(`
            CREATE TABLE User_Module (
                module_access_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                module_id VARCHAR(50) REFERENCES Module(module_id) ON DELETE CASCADE,
                group_id UUID REFERENCES Groups(group_id) ON DELETE CASCADE,
                user_id UUID REFERENCES Users(user_id) ON DELETE CASCADE
            )
        `);

        for (const m of data.User_Module_Access || []) {
            await pool.query(
                `INSERT INTO User_Module (module_access_id, module_id, group_id, user_id) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING`,
                [m.access_id, m.module_id, m.group_id || null, m.user_id || null]
            );
        }

        // 10. User_App_Actions (Dataset Access)
        console.log("- Migrating User_App_Actions...");
        for (const uaa of data.User_App_Actions || []) {
            try {
                await pool.query(
                    `INSERT INTO User_App_Actions (app_action_id, user_id, group_id, dataset_id, action_id) VALUES ($1, $2, $3, $4, $5) ON CONFLICT (app_action_id) DO NOTHING`,
                    [uaa.app_action_id, uaa.user_id || null, uaa.group_id || null, uaa.dataset_id, uaa.action_id]
                );
            } catch (err) {
                 console.warn(`  - Skipping app_action ${uaa.app_action_id}: ${err.message}`);
            }
        }

        // 11. Chat_History
        console.log("- Migrating Chat_History...");
        for (const ch of data.Chat_History || []) {
            try {
                await pool.query(
                    `INSERT INTO Chat_History (chat_id, user_id, dataset_id, query, response, timestamp, tokens_used) VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (chat_id) DO NOTHING`,
                    [ch.chat_id, ch.user_id, ch.dataset_id, ch.query, ch.response, ch.timestamp, ch.tokens_used || 0]
                );
            } catch (err) {
                 console.warn(`  - Skipping chat_history ${ch.chat_id}: ${err.message}`);
            }
        }

        console.log("Migration completed successfully!");
    } catch (err) {
        console.error("Migration failed:", err);
    } finally {
        await pool.end();
        process.exit();
    }
}

migrate();
