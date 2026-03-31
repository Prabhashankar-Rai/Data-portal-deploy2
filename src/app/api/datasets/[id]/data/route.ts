import { NextResponse } from 'next/server';
import { promises as fsPromises, createReadStream } from 'fs';
import readline from 'readline';
import path from 'path';
import type { DatasetConfig } from '../../route';
import { cookies } from 'next/headers';
import { getDb } from '@/lib/json-db';

const DATA_FILE = path.join(process.cwd(), 'data', 'datasets.json');

async function readDatasets(): Promise<DatasetConfig[]> {
  try {
    const raw = await fsPromises.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw) as DatasetConfig[];
  } catch {
    return [];
  }
}

function clean(value: string) {
  return value.trim().replace(/^"(.*)"$/, '$1');
}

function parseCSVLine(line: string): string[] {
  if (line.indexOf('"') === -1) {
    return line.split(',').map(v => clean(v));
  }

  const cells: string[] = [];
  let inQuotes = false;
  let cell = '';
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      cells.push(clean(cell));
      cell = '';
    } else {
      cell += c;
    }
  }
  cells.push(clean(cell));
  return cells;
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

    const userActions = db.User_App_Actions.filter((ua: any) =>
      (ua.user_id === userId || userGroupIds.includes(ua.group_id)) &&
      ua.dataset_id === requestedId
    );

    const actionMap = db.Actions.reduce((acc: Record<string, string>, a: any) => {
      acc[a.action_id] = a.action_name;
      return acc;
    }, {});

    const hasHidden = userActions.some((ua: any) => actionMap[ua.action_id] === 'Hidden');
    if (hasHidden) return { error: 'Access denied: Dataset is hidden.', status: 403 };

    const hasViewOrDownload = userActions.some((ua: any) =>
      ['View', 'Download'].includes(actionMap[ua.action_id])
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
    })).filter((f: any) => f.column_name); // Valid filters only
  }
  return { rowFilters };
}

// GET for backward compatibility and metadata
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const datasets = await readDatasets();
  const requestedId = id.trim().toLowerCase();
  const dataset = datasets.find(
    d => d.id.trim().toLowerCase() === requestedId,
  );

  if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

  const authResult = await getAuthAndFilters(requestedId);
  if (authResult.error) return NextResponse.json({ error: authResult.error }, { status: authResult.status });

  const { searchParams } = new URL(req.url);
  const isMeta = searchParams.get('meta') === 'true';

  try {
    const fileStream = createReadStream(dataset.filePath, 'utf8');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

    let isFirstLine = true;
    let validColumns: string[] = [];
    let validIndexes: number[] = [];
    const filterOptions: Record<string, Set<string>> = {};

    for await (const line of rl) {
      if (!line.trim()) continue;
      const values = parseCSVLine(line);

      if (isFirstLine) {
        values.forEach((col, i) => {
          if (col.length > 0) {
            validColumns.push(col);
            validIndexes.push(i);
            filterOptions[col] = new Set();
          }
        });
        isFirstLine = false;
        continue;
      }

      if (isMeta) {
        let allFull = true;
        for (let i = 0; i < validColumns.length; i++) {
          const colName = validColumns[i];
          const val = values[validIndexes[i]];
          if (val !== undefined && val !== '') {
            // we cap filter options at 200 to prevent runaway memory if there are many unique values
            if (filterOptions[colName].size < 200) {
              filterOptions[colName].add(val);
            }
          }
          if (filterOptions[colName].size < 200) allFull = false;
        }
        // Optional optimization: if all filter sets are at 200, we could stop early to save time if dataset is huge.
        // However, we want accurate dropdowns. Scanning 650K rows takes 1.5s, which is fine.
      } else {
        // Break if we are not meta and we just wanted 10 items (for testing backward compatibility)
        break;
      }
    }

    rl.close();
    fileStream.destroy();

    const resultOptions: Record<string, string[]> = {};
    for (const [col, set] of Object.entries(filterOptions)) {
      resultOptions[col] = Array.from(set).sort();
    }

    return NextResponse.json({ columns: validColumns, filterOptions: resultOptions, rows: [] });
  } catch (error: any) {
    return NextResponse.json({ error: `Unable to read dataset file: ${error?.message || String(error)}` }, { status: 500 });
  }
}

// POST for preview and export with filters applied directly from backend stream
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const datasets = await readDatasets();
  const requestedId = id.trim().toLowerCase();
  const dataset = datasets.find(d => d.id.trim().toLowerCase() === requestedId);

  if (!dataset) return NextResponse.json({ error: 'Dataset not found' }, { status: 404 });

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
    const fileStream = createReadStream(dataset.filePath, 'utf8');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    const encoder = new TextEncoder();

    let isFirstLine = true;
    let validColumns: string[] = [];
    let validIndexes: number[] = [];
    let rowsReturned = 0;

    const stream = new ReadableStream({
      async start(controller) {
        if (isPreview) {
          controller.enqueue(encoder.encode('{"rows":['));
        } else if (isExport) {
          controller.enqueue(encoder.encode((selectedColumns || []).join(',') + '\n'));
        }

        let isFirstRow = true;

        try {
          for await (const line of rl) {
            if (!line.trim()) continue;
            const values = parseCSVLine(line);

            if (isFirstLine) {
              values.forEach((col, i) => {
                if (col.length > 0) {
                  validColumns.push(col);
                  validIndexes.push(i);
                }
              });
              isFirstLine = false;
              continue;
            }

            if (isPreview && rowsReturned >= 10) {
              break;
            }

            const row: any = {};
            for (let i = 0; i < validColumns.length; i++) {
              const colName = validColumns[i];
              row[colName] = values[validIndexes[i]] !== undefined ? values[validIndexes[i]] : '';
            }

            let includeRow = true;
            if (rowFilters.length > 0) {
              includeRow = rowFilters.every((f: any) => {
                const colName = f.column_name;
                const userVal = f.element_value;
                const actualColKey = Object.keys(row).find(k => k.trim().toLowerCase() === colName.trim().toLowerCase());
                const rowVal = actualColKey ? row[actualColKey] : undefined;
                if (rowVal === undefined) return true;

                if (f.operator === '=') {
                  const matchVal = String(rowVal).toLowerCase();
                  const filterVal = String(userVal).toLowerCase();
                  if (matchVal === filterVal) return true;

                  // Handle LOB code abbreviations defined in the access matrix (e.g. FIR -> Fire, MOT -> Motor)
                  if (colName.trim().toLowerCase() === 'lob' && filterVal.length === 3 && matchVal.startsWith(filterVal)) {
                    return true;
                  }
                  return false;
                } else if (f.operator === '!=' || f.operator === '<>') {
                  const matchVal = String(rowVal).toLowerCase();
                  const filterVal = String(userVal).toLowerCase();
                  if (matchVal === filterVal) return false;

                  // Handle LOB code abbreviations defined in the access matrix (e.g. FIR -> Fire, MOT -> Motor)
                  if (colName.trim().toLowerCase() === 'lob' && filterVal.length === 3 && matchVal.startsWith(filterVal)) {
                    return false;
                  }
                  return true;
                }
                return true;
              });
            }

            if (includeRow && clientFilters) {
              for (const [colName, f] of Object.entries(clientFilters) as any) {
                if (!f || !f.operator) continue;
                const actualColKey = Object.keys(row).find(k => k.trim().toLowerCase() === colName.trim().toLowerCase());
                const rowVal = actualColKey ? row[actualColKey] : undefined;
                if (rowVal === undefined) continue;

                if (f.operator === 'eq' && typeof f.value === 'string' && f.value) {
                  if (rowVal !== f.value) includeRow = false;
                } else if (f.operator === 'between' && Array.isArray(f.value)) {
                  const [start, end] = f.value;
                  if (start && end) {
                    if (rowVal < start || rowVal > end) includeRow = false;
                  }
                } else if (f.operator === 'in' && Array.isArray(f.value) && f.value.length > 0) {
                  if (!f.value.includes(rowVal)) includeRow = false;
                } else if (f.operator === 'contains' && typeof f.value === 'string' && f.value) {
                  if (!String(rowVal).toLowerCase().includes(f.value.toLowerCase())) includeRow = false;
                }
              }
            }

            if (includeRow) {
              if (isPreview) {
                const prefix = isFirstRow ? '' : ',';
                controller.enqueue(encoder.encode(prefix + JSON.stringify(row)));
                isFirstRow = false;
                rowsReturned++;
              } else if (isExport) {
                const exportRowStr = (selectedColumns || []).map((c: string) => {
                  const val = row[c] !== undefined ? String(row[c]) : '';
                  if (val.includes(',') || val.includes('"')) {
                    return '"' + val.replace(/"/g, '""') + '"';
                  }
                  return val;
                }).join(',');
                controller.enqueue(encoder.encode(exportRowStr + '\n'));
              }
            }
          }

          if (isPreview) {
            controller.enqueue(encoder.encode('], "columns": ' + JSON.stringify(validColumns) + '}'));
          }
          controller.close();
          rl.close();
          if (fileStream && !fileStream.destroyed) fileStream.destroy();
        } catch (err) {
          controller.error(err);
          rl.close();
          if (fileStream && !fileStream.destroyed) fileStream.destroy();
        }
      }
    });

    const headers: HeadersInit = isExport
      ? { 'Content-Type': 'text/csv', 'Content-Disposition': `attachment; filename="${requestedId}.csv"` }
      : { 'Content-Type': 'application/json' };

    return new NextResponse(stream, { headers });
  } catch (error: any) {
    return NextResponse.json({ error: `Unable to process dataset file: ${error?.message || String(error)}` }, { status: 500 });
  }
}
