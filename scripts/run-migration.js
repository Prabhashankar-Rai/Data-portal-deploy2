const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');


const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: {
        rejectUnauthorized: false
    }
});

async function migrate() {
    const sql = fs.readFileSync(path.join(__dirname, 'migrate_datasets.sql'), 'utf-8');
    try {
        console.log('Running migration...');
        await pool.query(sql);
        console.log('Successfully migrated the Dataset table!');
    } catch (err) {
        console.error('Migration failed:', err);
    } finally {
        await pool.end();
    }
}

migrate();
