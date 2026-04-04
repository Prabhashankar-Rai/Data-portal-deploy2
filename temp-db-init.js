const { Pool } = require('pg');

const config = {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
};

async function init() {
    console.log("DATABASE_URL:", process.env.DATABASE_URL ? "FOUND" : "NOT FOUND");
    if (!process.env.DATABASE_URL) {
        console.error("DATABASE_URL is missing!");
        process.exit(1);
    }

    const pool = new Pool(config);

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
    } catch (err) {
        console.error("Error creating AuditLog table:", err);
    } finally {
        await pool.end();
        process.exit();
    }
}

init();
