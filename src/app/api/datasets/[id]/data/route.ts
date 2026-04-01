import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/json-db';
import { getWorkingDatasetTable } from '@/lib/dataset-utils';

async function fetchDatasetMetadata(id: string) {
  try {
    const res = await pool.query('SELECT * FROM Dataset WHERE dataset_id = $1', [id]);
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
      id: row.dataset_id,
      displayLabel: row.dataset_label,
      fileName: row.file_name,
      filePath: row.file_path,
      purpose: row.purpose,
      columns: row.columns_json
    };
  } catch (e) {
    console.error('Metadata fetch error:', e);
    return null;
  }
}

async function getAuthAndFilters(requestedId: string) {
  let rowFilters: any[] = [];
  const cookieStore = await cookies();
  const role = cookieStore.get('role')?.value || 'USER';
  const userId = cookieStore.get('user_id')?.value;
  const loggedIn = cookieStore.get('loggedIn')?.value;

  if (!loggedIn) return { error: 'Unauthorized', status: 401 };

  if (role !== 'ADMIN') {
    if (!userId) return { error: 'Unauthorized', status: 401 };

    const db = getDb();
    const userGroupIds = db.User_Groups
      .filter((ug: any) => ug.user_id === userId)
      .map((ug: any) => ug.group_id);

    const actionRes = await pool.query(`
      SELECT uaa.*, a.action_name 
      FROM User_App_Actions uaa
      JOIN Actions a ON uaa.action_id = a.action_id
      WHERE (uaa.user_id = $1 OR uaa.group_id = ANY($2::uuid[])) AND uaa.dataset_id = $3
    `, [userId, userGroupIds, requestedId]);

    const userActions = actionRes.rows;

    const hasHidden = userActions.some((ua: any) => ua.action_name === 'Hidden');
    if (hasHidden) return { error: 'Access denied: Dataset is hidden.', status: 403 };

    const hasViewOrDownload = userActions.some((ua: any) =>
      ['View', 'Download'].includes(ua.action_name)
    );
    if (!hasViewOrDownload) return { error: 'Access denied: You do not have view or download permissions for this dataset.', status: 403 };

    rowFilters = db.User_Access_Filter.filter((f: any) =>
      userGroupIds.includes(f.group_id)
    );

    const accessElements = db.Access_Elements.reduce((acc: Record<string, string>, e: any) => {
      acc[e.element_id] = e.generic_column_name;
      return acc;
    }, {});

    rowFilters = rowFilters.map((f: any) => ({
      ...f,
      column_name: accessElements[f.element_id]
    })).filter((f: any) => f.column_name);
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
    const tableName = await getWorkingDatasetTable(requestedId);
    
    // Get column names from PostgreSQL schema
    const colRes = await pool.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_name = $1
        ORDER BY ordinal_position
    `, [tableName]);
    
    const validColumns = colRes.rows.map(r => r.column_name);

    // Get filter options (distinct values) for visible columns
    // To speed up, we only do this if meta=true
    const { searchParams } = new URL(req.url);
    const isMeta = searchParams.get('meta') === 'true';
    const filterOptions: Record<string, string[]> = {};

    if (isMeta) {
        // We limit distinct values to 100 for metadata performance
        for (const col of validColumns) {
            const distinctRes = await pool.query(`
                SELECT DISTINCT "${col}" 
                FROM "${tableName}" 
                WHERE "${col}" IS NOT NULL AND "${col}" != ''
                LIMIT 100
            `);
            filterOptions[col] = distinctRes.rows.map(r => String(r[col])).sort();
        }
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
    const tableName = await getWorkingDatasetTable(requestedId);
    
    // Build WHERE clause
    const whereClauses: string[] = [];
    const queryParams: any[] = [];

    // Apply security row filters
    rowFilters.forEach((f, i) => {
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
        
        const previewRes = await pool.query(`
            SELECT ${selectCols} FROM "${tableName}" 
            ${whereString} 
            LIMIT 100
        `, queryParams);

        return NextResponse.json({ rows: previewRes.rows });
    }

    if (isExport) {
        // For export, we'll manually stream rows to avoid memory issues with huge datasets
        const client = await pool.connect();
        try {
            const selectCols = selectedColumns && selectedColumns.length > 0 
                ? selectedColumns.map((c: string) => `"${c}"`).join(', ')
                : '*';
            
            // Note: In a real production app, we'd use pg-query-stream here.
            // For now, we'll fetch in one go or use a cursor if available.
            // Since this is a simple implementation, we'll do a basic SELECT.
            const exportRes = await client.query(`
                SELECT ${selectCols} FROM "${tableName}" 
                ${whereString}
            `, queryParams);

            const csvContent = [
                selectedColumns.join(','),
                ...exportRes.rows.map(row => 
                    selectedColumns.map((c: string) => {
                        const val = String(row[c] || '');
                        return val.includes(',') || val.includes('"') 
                            ? `"${val.replace(/"/g, '""')}"` 
                            : val;
                    }).join(',')
                )
            ].join('\n');

            return new NextResponse(csvContent, {
                headers: {
                    'Content-Type': 'text/csv',
                    'Content-Disposition': `attachment; filename="${requestedId}.csv"`
                }
            });
        } finally {
            client.release();
        }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    console.error('Data route error:', error);
    return NextResponse.json({ error: `Data processing error: ${error?.message || String(error)}` }, { status: 500 });
  }
}
