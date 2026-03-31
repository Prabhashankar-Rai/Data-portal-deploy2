import { Pool } from 'pg';

let pool: Pool;

if (process.env.NODE_ENV === 'production') {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
    });
} else {
    // In development, we use a global variable to persist the connection across HMR reloads
    if (!(global as any).pgPool) {
        (global as any).pgPool = new Pool({
            connectionString: process.env.DATABASE_URL,
        });
    }
    pool = (global as any).pgPool;
}

export default pool;
