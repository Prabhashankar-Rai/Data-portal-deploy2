import pool from './src/lib/db';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.join(__dirname, '.env.local') });

async function init() {
    try {
        console.log("Creating AuditLog table in Neon database...");
        await pool.query(`
            CREATE TABLE IF NOT EXISTS AuditLog (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
                user_role VARCHAR(50),
                username VARCHAR(255),
                action VARCHAR(255),
                page TEXT,
                details JSONB
            );
        `);
        console.log("AuditLog table created/verified successfully.");
    } catch (err: any) {
        console.error("Error creating AuditLog table:", err.message || err);
    } finally {
        process.exit();
    }
}

init();
