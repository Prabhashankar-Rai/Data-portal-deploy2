import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { getWorkingDatasetTable } from '@/lib/dataset-utils';

/**
 * Correctly escape a schema-qualified table name for PostgreSQL.
 * e.g. "ads.table" -> "\"ads\".\"table\""
 */
function formatTableName(name: string): string {
    if (name.includes('.')) {
        return name.split('.').map(part => `"${part}"`).join('.');
    }
    return `"${name}"`;
}

async function fetchDatasetMetadata(id: string) {
  try {
    const res = await pool.query('SELECT * FROM Dataset WHERE dataset_id = $1', [id]);
    if (res.rows.length === 0) {
      console.warn(`[DATA] Metadata not found for ID: ${id}`);
      return null;
    }
    const row = res.rows[0];
    return {
      id: row.dataset_id,
      displayLabel: row.dataset_label || row.dataset_name || id,
      fileName: row.file_name,
      filePath: row.file_path,
      purpose: row.purpose,
      columns: row.columns_json
    };
  } catch (e) {
    console.error(`[DATA] Metadata fetch error for ${id}:`, e);
    return null;
  }
}

async function getAuthAndFilters(requestedId: string) {
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value || 'USER';
  const userId = cookieStore.get('user_id')?.value;
  const loggedIn = cookieStore.get('loggedIn')?.value;

  if (!loggedIn) return { error: 'Unauthorized', status: 401 };

  let rowFilters: any[] = [];

  if (role !== 'ADMIN') {
    if (!userId) return { error: 'Unauthorized', status: 401 };

    // Fetch user groups
    const groupRes = await pool.query('SELECT group_id FROM User_Group WHERE user_id::text = $1', [userId]);
    const userGroupIds = groupRes.rows.map((r: any) => r.group_id);

    // Fetch user actions for this dataset (user or group-level)
    const actionRes = await pool.query(`
      SELECT uaa.*, a.action_name 
      FROM User_App_Actions uaa
      JOIN Actions a ON uaa.action_id = a.action_id
      WHERE (uaa.user_id::text = $1 OR uaa.group_id = ANY($2::uuid[]))
      AND uaa.dataset_id = $3
    `, [userId, userGroupIds, requestedId]);

    const userActions = actionRes.rows;

    const hasHidden = userActions.some((ua: any) => ua.action_name === 'Hidden');
    if (hasHidden) return { error: 'Access denied: Dataset is hidden.', status: 403 };

    const hasViewOrDownload = userActions.some((ua: any) =>
      ['View', 'Download', 'AI Chat'].includes(ua.action_name)
    );
    if (!hasViewOrDownload) return { error: 'Access denied: You do not have view or download permissions for this dataset.', status: 403 };

    if (userGroupIds.length > 0) {
      // Fetch row filters for these groups
      const filterRes = await pool.query(`
        SELECT f.*, e.generic_column_name as column_name
        FROM User_Access_Filter f
        JOIN Access_Elements e ON f.element_id = e.element_id
        WHERE f.group_id = ANY($1::uuid[])
      `, [userGroupIds]);
      rowFilters = filterRes.rows;
    }
  }
  return { rowFilters };
}

// GET for metadata and filter options
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestedId = id.trim().toLowerCase();
  const dataset = await fetchDatasetMetadata(requestedId);

  if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

  const authResult = await getAuthAndFilters(requestedId);
  if (authResult.error) return NextResponse.json({ error: authResult.error }, { status: authResult.status });

  try {
    const { tableName, pool: dsPool } = await getWorkingDatasetTable(requestedId);
    
    // Get column names from PostgreSQL schema of the correct pool
    // We need to handle schema-qualified names for the information_schema query
    const parts = tableName.split('.');
    const tableOnly = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const schemaOnly = parts.length > 1 ? parts[0] : 'public';

    const colRes = await dsPool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = $2
        ORDER BY ordinal_position
    `, [tableOnly, schemaOnly]);
    
    const validColumns = colRes.rows.map(r => r.column_name);

    // Get filter options (distinct values) for visible columns
    // To speed up, we only do this if meta=true
    const { searchParams } = new URL(req.url);
    const isMeta = searchParams.get('meta') === 'true';
    const filterOptions: Record<string, string[]> = {};

    if (isMeta) {
        const formattedTable = formatTableName(tableName);
        
        // Fetch distinct values for all columns in parallel to reduce sequential DB latency
        const distinctPromises = validColumns.map(async (col) => {
            try {
                const distinctRes = await dsPool.query(`
                    SELECT DISTINCT "${col}" 
                    FROM ${formattedTable} 
                    WHERE "${col}" IS NOT NULL
                    LIMIT 100
                `);
                return {
                    col,
                    values: distinctRes.rows
                        .map(r => String(r[col]))
                        .filter(v => v.trim() !== '')
                        .sort()
                };
            } catch (colErr: any) {
                console.warn(`[DATA] Skipping filter options for column "${col}": ${colErr.message}`);
                return { col, values: [] };
            }
        });

        const results = await Promise.all(distinctPromises);
        results.forEach(({ col, values }) => {
            filterOptions[col] = values;
        });
    }

    return NextResponse.json({ columns: validColumns, filterOptions, rows: [] });
  } catch (error: any) {
    return NextResponse.json({ error: `Dataset sync error: ${error?.message || String(error)}` }, { status: 500 });
  }
}

// POST for preview and export using PostgreSQL filters
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const requestedId = id.trim().toLowerCase();
  
  const authResult = await getAuthAndFilters(requestedId);
  if (authResult.error) return NextResponse.json({ error: authResult.error }, { status: authResult.status });
  const rowFilters = authResult.rowFilters || [];

  let body: any = {};
  try {
    body = await req.json();
  } catch { }

  const { action, filters: clientFilters, selectedColumns } = body;
  const isPreview = action === 'preview';
  const isExport = action === 'export';

  if (!isPreview && !isExport) {
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }

  try {
    const { tableName, pool: dsPool } = await getWorkingDatasetTable(requestedId);
    
    // Build WHERE clause
    const whereClauses: string[] = [];
    const queryParams: any[] = [];

    // Apply security row filters
    rowFilters.forEach((f) => {
        const col = f.column_name.toLowerCase().replace(/[^a-z0-9_]/g, '_');
        queryParams.push(f.element_value.toLowerCase());
        whereClauses.push(`LOWER("${col}") ${f.operator === '!=' ? '!=' : '='} $${queryParams.length}`);
    });

    // Apply client-side filters
    if (clientFilters) {
        for (const [colName, f] of Object.entries(clientFilters) as any) {
            if (!f || !f.operator || f.value === undefined || f.value === '') continue;
            const col = colName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
            
            if (f.operator === 'eq') {
                queryParams.push(f.value);
                whereClauses.push(`"${col}" = $${queryParams.length}`);
            } else if (f.operator === 'contains') {
                queryParams.push(`%${f.value}%`);
                whereClauses.push(`"${col}" ILIKE $${queryParams.length}`);
            } else if (f.operator === 'in' && Array.isArray(f.value) && f.value.length > 0) {
                const placeholders = f.value.map((_: any) => {
                    queryParams.push(_);
                    return `$${queryParams.length}`;
                });
                whereClauses.push(`"${col}" IN (${placeholders.join(', ')})`);
            } else if (f.operator === 'between' && Array.isArray(f.value)) {
                const [start, end] = f.value;
                if (start && end) {
                    queryParams.push(start, end);
                    whereClauses.push(`"${col}" BETWEEN $${queryParams.length - 1} AND $${queryParams.length}`);
                }
            }
        }
    }

    const whereString = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    if (isPreview) {
        const selectCols = selectedColumns && selectedColumns.length > 0 
            ? selectedColumns.map((c: string) => `"${c}"`).join(', ')
            : '*';
        
        const formattedTable = formatTableName(tableName);
        const previewRes = await dsPool.query(`
            SELECT ${selectCols} FROM ${formattedTable} 
            ${whereString} 
            LIMIT 100
        `, queryParams);

        return NextResponse.json({ rows: previewRes.rows });
    }

    if (isExport) {
        let client: any = null;
        try {
            const { Readable, Transform } = await import('stream');
            const QueryStream = (await import('pg-query-stream')).default;
            
            const selectCols = selectedColumns && selectedColumns.length > 0 
                ? selectedColumns.map((c: string) => `"${c}"`).join(', ')
                : '*';
            
            const formattedTable = formatTableName(tableName);
            const queryText = `SELECT ${selectCols} FROM ${formattedTable} ${whereString}`;
            
            client = await dsPool.connect();
            // Increase batchSize to 10,000 to minimize network round-trips over high-latency links
            const queryStream = client.query(new QueryStream(queryText, queryParams, { batchSize: 10000 }));

            // Transform each row object into a CSV string
            const csvTransform = new Transform({
                writableObjectMode: true,
                transform(row, encoding, callback) {
                    try {
                        const line = selectedColumns.map((c: string) => {
                            const val = String(row[c] ?? '');
                            return val.includes(',') || val.includes('"') || val.includes('\n')
                                ? `"${val.replace(/"/g, '""')}"` 
                                : val;
                        }).join(',') + '\n';
                        callback(null, line);
                    } catch (err: any) {
                        callback(err);
                    }
                }
            });

            // Write header first
            csvTransform.write(selectedColumns.reduce((acc: any, col: string) => {
                acc[col] = col; // Fake row for header
                return acc;
            }, {}));

            const nodeStream = queryStream.pipe(csvTransform);
            
            // Clean up on finish/error
            nodeStream.on('finish', () => { if (client) { client.release(); client = null; } });
            nodeStream.on('error', (err: any) => { 
                console.error('Stream pipeline error:', err);
                if (client) { client.release(); client = null; } 
            });

            // Convert Node stream to Web stream
            const webStream = Readable.toWeb(nodeStream);

            // Apply GZIP compression using native CompressionStream
            // This reduces the 50MB payload to < 5MB (10x reduction in network transfer time)
            const compressedStream = webStream.pipeThrough(new CompressionStream('gzip') as any);

            return new NextResponse(compressedStream as any, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${requestedId}.csv.gz"`,
                    'Content-Encoding': 'gzip',
                    'Cache-Control': 'no-cache',
                    'Connection': 'keep-alive'
                }
            });
        } catch (error: any) {
            if (client) client.release();
            throw error;
        }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Data route error:', error);
    return NextResponse.json({ error: `Data processing error: ${error?.message || String(error)}` }, { status: 500 });
  }
}
