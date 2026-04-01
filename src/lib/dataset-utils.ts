import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import pool from './db';

/**
 * Gets a reliable file path for a dataset.
 * If the dataset has csv_content in the DB, it writes it to a temporary file in /tmp.
 * Otherwise, it returns the legacy filePath stored in the metadata.
 */
export async function getWorkingDatasetPath(datasetId: string): Promise<string> {
    try {
        const res = await pool.query('SELECT file_path, csv_content FROM Dataset WHERE dataset_id = $1', [datasetId]);
        
        if (res.rows.length === 0) {
            throw new Error(`Dataset ${datasetId} not found in database.`);
        }

        const { file_path, csv_content } = res.rows[0];

        // If we have content in the DB, write to /tmp and return that path
        if (csv_content) {
            const tmpDir = os.tmpdir();
            const tmpPath = path.join(tmpDir, `dataset-${datasetId}-${Date.now()}.csv`);
            await fs.writeFile(tmpPath, csv_content, 'utf-8');
            console.log(`[DatasetUtils] Created temporary file for ${datasetId} at ${tmpPath}`);
            return tmpPath;
        }

        // Fallback to legacy file path (absolute or relative to public)
        let resolvedPath = file_path;
        if (!path.isAbsolute(resolvedPath)) {
            resolvedPath = path.join(process.cwd(), 'public', 'data-download', path.basename(resolvedPath));
        }

        return resolvedPath;
    } catch (err) {
        console.error(`[DatasetUtils] Error resolving path for ${datasetId}:`, err);
        throw err;
    }
}
