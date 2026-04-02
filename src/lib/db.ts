import { Pool, PoolConfig } from 'pg';

const metadataConfig: PoolConfig = {
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL?.includes('sslmode=require') || process.env.NODE_ENV === 'production' 
        ? { rejectUnauthorized: false } 
        : false,
};

const warehouseConfig: PoolConfig = {
    connectionString: process.env.WAREHOUSE_URL,
    ssl: false, // Server at 172.16.10.212 does not support SSL
};

console.log(`[DB] Metadata URL defined: ${!!process.env.DATABASE_URL}, Warehouse URL defined: ${!!process.env.WAREHOUSE_URL}`);

let pool: Pool;
let warehousePool: Pool | null = null;

if (process.env.NODE_ENV === 'production') {
    pool = new Pool(metadataConfig);
    if (process.env.WAREHOUSE_URL) {
        warehousePool = new Pool(warehouseConfig);
    }
} else {
    // In development, handle hot-reloads
    if (!(global as any).pgPool) {
        (global as any).pgPool = new Pool(metadataConfig);
    }
    pool = (global as any).pgPool;

    // Dynamically initialize warehousePool if URL is provided and pool is missing
    if (process.env.WAREHOUSE_URL) {
        if (!(global as any).pgWarehousePool) {
            console.log('[DB] Initializing Warehouse Pool (SSL: OFF)...');
            (global as any).pgWarehousePool = new Pool(warehouseConfig);
        }
        warehousePool = (global as any).pgWarehousePool;
    } else {
        warehousePool = null;
    }
}

export default pool;
export { warehousePool };
