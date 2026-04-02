import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export type FilterType = 'none' | 'date' | 'multi' | 'text' | 'number';

export type ColumnConfig = {
  name: string;
  visible: boolean;
  filter: FilterType;
  description?: string;
  aiRestricted?: boolean;
};

export type DatasetConfig = {
  id: string;
  displayLabel: string;
  sourceType: 'FILE' | 'WAREHOUSE';
  fileName: string;
  filePath: string;
  warehouseTable?: string;
  purpose: string;
  columns: ColumnConfig[];
  createdBy: string;
  updatedAt: string;
};

import { cookies } from 'next/headers';
import { getDb } from '@/lib/json-db';

export async function GET() {
  try {
    const res = await pool.query('SELECT * FROM Dataset ORDER BY updated_at DESC');
    const datasets: DatasetConfig[] = res.rows.map(row => ({
      id: row.dataset_id,
      displayLabel: row.dataset_label || row.dataset_name || '',
      sourceType: row.source_type || 'FILE',
      fileName: row.file_name,
      filePath: row.file_path,
      warehouseTable: row.warehouse_table,
      purpose: row.purpose || '',
      columns: row.columns_json || [],
      createdBy: row.created_by || 'ADMIN',
      updatedAt: row.updated_at.toISOString(),
    }));

    const cookieStore = await cookies();
    const role = cookieStore.get('role')?.value || 'USER';
    const userId = cookieStore.get('user_id')?.value;
    const loggedIn = cookieStore.get('loggedIn')?.value;

    if (!loggedIn) {
      return NextResponse.json([], { status: 401 });
    }

    if (role === 'ADMIN') {
      const adminDatasets = datasets.map(d => ({
        ...d,
        hasDownload: true,
        hasView: true,
        hasAIChat: true
      }));
      return NextResponse.json(adminDatasets);
    }

    if (!userId) {
      return NextResponse.json([]);
    }

    const db = getDb(); // Still using json-db for Users/Groups
    const userGroupIds = db.User_Groups
      .filter((ug: any) => ug.user_id === userId)
      .map((ug: any) => ug.group_id);

    // We'll also check the User_App_Actions table in DB for permissions
    const actionRes = await pool.query(`
      SELECT uaa.*, a.action_name 
      FROM User_App_Actions uaa
      JOIN Actions a ON uaa.action_id = a.action_id
      WHERE uaa.user_id = $1 OR uaa.group_id = ANY($2::uuid[])
    `, [userId, userGroupIds]);

    const userActions = actionRes.rows;

    const allowedDatasets = datasets.reduce((acc: any[], d: DatasetConfig) => {
      const datasetActions = userActions.filter((ua: any) => ua.dataset_id === d.id);
      const hasHidden = datasetActions.some((ua: any) => ua.action_name === 'Hidden');
      if (hasHidden) return acc;

      const hasDownload = datasetActions.some((ua: any) => ua.action_name === 'Download');
      const hasView = datasetActions.some((ua: any) => ua.action_name === 'View');
      const hasAIChat = datasetActions.some((ua: any) => ua.action_name === 'AI Chat');

      if (hasDownload || hasView || hasAIChat) {
        acc.push({
          ...d,
          hasDownload,
          hasView,
          hasAIChat
        });
      }
      return acc;
    }, []);

    return NextResponse.json(allowedDatasets);
  } catch (err: any) {
    console.error('API Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const contentType = request.headers.get('content-type') || '';
    let data: any = {};

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      data.id = formData.get('id') as string;
      data.displayLabel = formData.get('displayLabel') as string;
      data.sourceType = (formData.get('sourceType') as string) || 'FILE';
      data.fileName = formData.get('fileName') as string;
      data.filePath = formData.get('filePath') as string;
      data.warehouseTable = formData.get('warehouseTable') as string;
      data.purpose = formData.get('purpose') as string;
      try {
        data.columns = JSON.parse(formData.get('columns') as string || '[]');
      } catch (e) {
        console.error('Error parsing columns JSON:', e);
        data.columns = [];
      }
      data.createdBy = (formData.get('createdBy') as string) || undefined;
      
      const file = formData.get('file') as File | null;
      if (file && typeof file !== 'string') {
        // Option B: Save locally for dev
        try {
          const fs = require('fs');
          const path = require('path');
          const uploadDir = path.join(process.cwd(), 'public', 'uploads');
          if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
          }
          const safeName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
          const fullPath = path.join(uploadDir, safeName);
          const buffer = Buffer.from(await file.arrayBuffer());
          fs.writeFileSync(fullPath, buffer);
          
          data.filePath = `/uploads/${safeName}`; // Relative path for public access
          // Still store first 1MB in DB for preview/AI chat (optional)
          data.csvContent = (await file.text()).slice(0, 500000); 
        } catch (e: any) {
          console.error('Local File Save Error:', e);
          // Fallback to DB row storage
          data.csvContent = await file.text();
        }
      } else {
        data.csvContent = formData.get('csvContent') as string;
      }
    } else {
      data = await request.json();
    }

    const {
      id,
      displayLabel,
      sourceType = 'FILE',
      fileName,
      filePath,
      warehouseTable,
      purpose,
      columns,
      csvContent,
      createdBy = 'ADMIN',
    } = data as Partial<DatasetConfig> & { columns?: ColumnConfig[], csvContent?: string, sourceType?: string, warehouseTable?: string };

    if (!displayLabel || (!fileName && sourceType === 'FILE')) {
      console.warn('[API/DATASETS] Validation failed: missing displayLabel or fileName', { displayLabel, fileName, sourceType });
      return NextResponse.json(
        { error: 'Display Label and File Name are required.' },
        { status: 400 },
      );
    }

    const slugFromLabel = displayLabel
      ? displayLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
      : `dataset-${Date.now()}`;

    const datasetId = id || slugFromLabel;
    const now = new Date();

    // Ensure displayLabel is not null for the DB constraint
    const finalLabel = displayLabel || fileName || warehouseTable || datasetId;

    console.log('[API/DATASETS] Finalizing registration:', {
      datasetId,
      finalLabel,
      sourceType,
      warehouseTable
    });

    const query = `
      INSERT INTO Dataset (dataset_id, dataset_label, dataset_name, source_type, file_name, file_path, warehouse_table, purpose, columns_json, csv_content, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (dataset_id) DO UPDATE SET
        dataset_label = EXCLUDED.dataset_label,
        dataset_name = EXCLUDED.dataset_name,
        source_type = EXCLUDED.source_type,
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        warehouse_table = EXCLUDED.warehouse_table,
        purpose = EXCLUDED.purpose,
        columns_json = EXCLUDED.columns_json,
        csv_content = EXCLUDED.csv_content,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const res = await pool.query(query, [
      datasetId,
      finalLabel,
      finalLabel, // dataset_name
      sourceType,
      fileName,
      filePath || '',
      warehouseTable || null,
      purpose || '',
      JSON.stringify(columns || []),
      csvContent || null,
      createdBy,
      now
    ]);

    const row = res.rows[0];
    const newConfig: DatasetConfig = {
      id: row.dataset_id,
      displayLabel: row.dataset_label || row.dataset_name,
      sourceType: row.source_type || 'FILE',
      fileName: row.file_name,
      filePath: row.file_path,
      warehouseTable: row.warehouse_table,
      purpose: row.purpose || '',
      columns: row.columns_json || [],
      createdBy: row.created_by || 'ADMIN',
      updatedAt: row.updated_at.toISOString(),
    };

    return NextResponse.json(newConfig);
  } catch (err: any) {
    console.error('POST Error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


