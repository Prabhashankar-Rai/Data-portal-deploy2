import { NextResponse } from 'next/server';
import { createReadStream, existsSync } from 'fs';
import readline from 'readline';
import { warehousePool } from '@/lib/db';

function clean(value: string) {
  return value.trim().replace(/^"(.*)"$/, '$1');
}

export async function POST(request: Request) {
  const { sourceType, filePath, warehouseTable, csvContent } = (await request.json()) as { 
    sourceType?: 'FILE' | 'WAREHOUSE',
    filePath?: string, 
    warehouseTable?: string,
    csvContent?: string 
  };

  if (sourceType === 'WAREHOUSE') {
    if (!warehouseTable) {
      return NextResponse.json({ error: 'warehouseTable is required for warehouse source' }, { status: 400 });
    }
    console.log(`[PreviewColumns] WAREHOUSE_URL exists: ${!!process.env.WAREHOUSE_URL}`);
    if (!warehousePool) {
      return NextResponse.json({ error: 'Warehouse connection (WAREHOUSE_URL) is not configured.' }, { status: 500 });
    }

    try {
      console.log(`[PreviewColumns] Fetching columns for warehouse table: "${warehouseTable}"`);
      
      const parts = warehouseTable.split('.');
      const table = parts.pop();
      const schema = parts.length > 0 ? parts.join('.') : 'public';
      
      console.log(`[PreviewColumns] Parsed into Schema: "${schema}", Table: "${table}"`);

      // Query column names from the warehouse table
      const res = await warehousePool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = $2
        ORDER BY ordinal_position
      `, [table, schema]);

      console.log(`[PreviewColumns] information_schema found ${res.rows.length} columns.`);

      if (res.rows.length === 0) {
        // Fallback: try direct query
        console.log(`[PreviewColumns] Trying direct SELECT LIMIT 0 fallback...`);
        const directRes = await warehousePool.query(`SELECT * FROM ${warehouseTable} LIMIT 0`);
        const columns = directRes.fields.map(f => f.name);
        console.log(`[PreviewColumns] Fallback found ${columns.length} columns.`);
        return NextResponse.json({ columns });
      }

      const columns = res.rows.map(row => row.column_name);
      return NextResponse.json({ columns });
    } catch (error: any) {
      console.error('[PreviewColumns] Warehouse error:', error);
      return NextResponse.json({ error: `Warehouse error: ${error.message}` }, { status: 500 });
    }
  }

  // File source logic (mostly unchanged)
  if (!filePath && !csvContent) {
    return NextResponse.json(
      { error: 'filePath or csvContent is required' },
      { status: 400 },
    );
  }

  try {
    let firstLine = '';

    if (csvContent) {
      // Split by newline and take the first non-empty line
      const lines = csvContent.split(/\r?\n/);
      for (const line of lines) {
        if (line.trim()) {
          firstLine = line;
          break;
        }
      }
    } else if (filePath) {
      // Handle /uploads/ logic or local paths
      const path = require('path');
      const absolutePath = filePath.startsWith('/uploads/') 
        ? path.join(process.cwd(), 'public', filePath)
        : filePath;

      if (!existsSync(absolutePath)) {
        throw new Error(`File not found: ${absolutePath}`);
      }

      const fileStream = createReadStream(absolutePath, 'utf8');
      const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
      
      for await (const line of rl) {
        if (line.trim()) {
          firstLine = line;
          break; 
        }
      }
      rl.close();
      fileStream.destroy();
    }

    if (!firstLine) {
      return NextResponse.json({ error: 'CSV is empty' }, { status: 400 });
    }

    const columns = firstLine.split(',').map(clean).filter((c: string) => c.length > 0);
    return NextResponse.json({ columns });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Unable to read file: ${error?.message || String(error)}` },
      { status: 500 },
    );
  }
}
