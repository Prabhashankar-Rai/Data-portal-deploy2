import { NextResponse } from 'next/server';
import { warehousePool } from '@/lib/db';

export async function GET() {
  const status = {
    warehouseUrlSet: !!process.env.WAREHOUSE_URL,
    warehousePoolInitialized: !!warehousePool,
    error: null as string | null,
    testQueryResult: null as any,
  };

  if (!warehousePool) {
    return NextResponse.json({ ...status, error: 'Warehouse pool not initialized. Check WAREHOUSE_URL.' });
  }

  try {
    const res = await warehousePool.query('SELECT NOW()');
    status.testQueryResult = res.rows[0];
  } catch (e: any) {
    status.error = e.message;
  }

  return NextResponse.json(status);
}
