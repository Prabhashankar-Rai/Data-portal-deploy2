import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datasetId = id.trim();

    // 1. Get dataset metadata before deleting (to know source type)
    const metaRes = await pool.query(
      'SELECT source_type FROM Dataset WHERE dataset_id = $1',
      [datasetId]
    );

    if (metaRes.rows.length === 0) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }

    // 2. Delete associated permission rows first (FK constraint)
    await pool.query('DELETE FROM User_App_Actions WHERE dataset_id = $1', [datasetId]);

    // 3. Drop file-based shelf table if it exists (cleanup for FILE sources)
    const sourceType = metaRes.rows[0].source_type;
    if (sourceType !== 'WAREHOUSE') {
      const shelfTable = `ds_${datasetId.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
      try {
        await pool.query(`DROP TABLE IF EXISTS "${shelfTable}"`);
      } catch (dropErr: any) {
        console.warn(`[DELETE] Could not drop shelf table "${shelfTable}":`, dropErr.message);
      }
    }

    // 4. Delete the dataset record
    await pool.query('DELETE FROM Dataset WHERE dataset_id = $1', [datasetId]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete dataset: ' + error.message },
      { status: 500 }
    );
  }
}
