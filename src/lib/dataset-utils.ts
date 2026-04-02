import pool, { warehousePool } from './db';
import { Pool } from 'pg';
import { parse } from 'csv-parse/sync';

/**
 * Ensures that a PostgreSQL table exists for the given dataset.
 * For WAREHOUSE sources, it simply returns the warehouse table name.
 * For FILE sources, it creates/populates a shelf table from the CSV.
 * Returns the name of the table and the pool to use for querying.
 */
export async function getWorkingDatasetTable(datasetId: string): Promise<{ tableName: string, pool: Pool }> {
    // 1. Fetch Dataset Metadata
    const metaRes = await pool.query('SELECT source_type, warehouse_table, csv_content, file_path FROM Dataset WHERE dataset_id = $1', [datasetId]);
    
    if (metaRes.rows.length === 0) {
        throw new Error(`Dataset ${datasetId} not found in the database.`);
    }

    const { source_type, warehouse_table, csv_content, file_path } = metaRes.rows[0];

    // --- CASE A: Warehouse Source ---
    if (source_type === 'WAREHOUSE') {
        if (!warehouse_table) {
            throw new Error(`Dataset ${datasetId} is set to WAREHOUSE but has no table name.`);
        }
        if (!warehousePool) {
            throw new Error(`Warehouse connection is not configured in .env.local (WAREHOUSE_URL).`);
        }
        return { tableName: warehouse_table, pool: warehousePool };
    }

    // --- CASE B: File Source (Legacy or Local) ---
    const tableName = `ds_${datasetId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    
    try {
        // Check if table exists in default pool (Neon)
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            )
        `, [tableName]);

        if (tableCheck.rows[0].exists) {
            return { tableName, pool };
        }

        console.log(`[DatasetUtils] Creating table ${tableName} for dataset ${datasetId}...`);
        
        let csvContent = csv_content || '';

        // If file_path is provided, try to read from it
        if (file_path) {
            try {
                const fs = require('fs');
                const path = require('path');
                if (file_path.startsWith('/uploads/')) {
                    const filePath = path.join(process.cwd(), 'public', file_path);
                    if (fs.existsSync(filePath)) {
                        csvContent = fs.readFileSync(filePath, 'utf8');
                    }
                } else if (file_path.startsWith('http')) {
                    const response = await fetch(file_path);
                    csvContent = await response.text();
                } else if (fs.existsSync(file_path)) {
                    csvContent = fs.readFileSync(file_path, 'utf8');
                }
            } catch (err) {
                console.error(`[DatasetUtils] Failed to read CSV from file_path ${file_path}:`, err);
            }
        }

        if (!csvContent) {
            throw new Error(`Dataset ${datasetId} has no CSV content or file reference.`);
        }
        
        // Parse CSV
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (records.length === 0) {
            throw new Error(`Dataset ${datasetId} CSV is empty.`);
        }

        const firstRecord = records[0];
        if (!firstRecord || typeof firstRecord !== 'object') {
            throw new Error(`Dataset ${datasetId} CSV has invalid format.`);
        }

        const headers = Object.keys(firstRecord);
        const sanitizedHeaders = headers.map(h => 
            h.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        );

        // Create table in Default Pool
        const columnDefinitions = sanitizedHeaders.map(h => `"${h}" TEXT`).join(', ');
        await pool.query(`CREATE TABLE IF NOT EXISTS "${tableName}" (${columnDefinitions})`);

        // Insert data in batches
        const batchSize = 100;
        for (let i = 0; i < records.length; i += batchSize) {
            const batch = records.slice(i, i + batchSize);
            const values: any[] = [];
            const placeholders: string[] = [];
            
            batch.forEach((record: any, rowIndex: number) => {
                const rowPlaceholders = headers.map((h, colIndex) => 
                    `$${values.length + 1}`
                );
                headers.forEach(h => values.push(record[h]));
                placeholders.push(`(${rowPlaceholders.join(', ')})`);
            });

            const insertQuery = `INSERT INTO "${tableName}" ("${sanitizedHeaders.join('", "')}") VALUES ${placeholders.join(', ')}`;
            await pool.query(insertQuery, values);
        }

        console.log(`[DatasetUtils] Table ${tableName} created and populated for ${datasetId}.`);
        return { tableName, pool };
    } catch (err) {
        console.error(`[DatasetUtils] Error synchronizing table for ${datasetId}:`, err);
        throw err;
    }
}
