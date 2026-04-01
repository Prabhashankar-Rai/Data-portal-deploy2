import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    
    const res = await pool.query('DELETE FROM Dataset WHERE dataset_id = $1 RETURNING *', [id]);
    
    if (res.rowCount === 0) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Delete Error:', error);
    return NextResponse.json(
      { error: 'Failed to delete dataset: ' + error.message },
      { status: 500 }
    );
  }
}

