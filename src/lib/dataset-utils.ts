import pool from './db';
import { parse } from 'csv-parse/sync';

/**
 * Ensures that a PostgreSQL table exists for the given dataset.
 * If the table doesn't exist, it creates and populates it from the Dataset table's csv_content.
 * Returns the name of the table.
 */
export async function getWorkingDatasetTable(datasetId: string): Promise<string> {
    const tableName = `ds_${datasetId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    
    try {
        // Check if table exists
        const tableCheck = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            )
        `, [tableName]);

        if (tableCheck.rows[0].exists) {
            return tableName;
        }

        console.log(`[DatasetUtils] Creating table ${tableName} for dataset ${datasetId}...`);
        
        // Fetch CSV content
        const res = await pool.query('SELECT csv_content FROM Dataset WHERE dataset_id = $1', [datasetId]);
        
        if (res.rows.length === 0 || !res.rows[0].csv_content) {
            throw new Error(`Dataset ${datasetId} has no CSV content in the database.`);
        }

        const csvContent = res.rows[0].csv_content;
        
        // Parse CSV to get headers and rows
        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (records.length === 0) {
            throw new Error(`Dataset ${datasetId} CSV is empty.`);
        }

        const headers = Object.keys(records[0]);
        const sanitizedHeaders = headers.map(h => 
            h.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()
        );

        // Create table
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
        return tableName;
    } catch (err) {
        console.error(`[DatasetUtils] Error synchronizing table for ${datasetId}:`, err);
        throw err;
    }
}
