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
  fileName: string;
  filePath: string;
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
      displayLabel: row.dataset_label,
      fileName: row.file_name,
      filePath: row.file_path,
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
    const body = await request.json();

    const {
      id,
      displayLabel,
      fileName,
      filePath,
      purpose,
      columns,
      csvContent,
      createdBy = 'ADMIN',
    } = body as Partial<DatasetConfig> & { columns?: ColumnConfig[], csvContent?: string };

    if (!displayLabel || !fileName) {
      return NextResponse.json(
        { error: 'displayLabel and fileName are required.' },
        { status: 400 },
      );
    }

    const slugFromLabel = displayLabel
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');

    const datasetId = id || slugFromLabel || `dataset-${Date.now()}`;
    const now = new Date();

    const query = `
      INSERT INTO Dataset (dataset_id, dataset_label, file_name, file_path, purpose, columns_json, csv_content, created_by, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      ON CONFLICT (dataset_id) DO UPDATE SET
        dataset_label = EXCLUDED.dataset_label,
        file_name = EXCLUDED.file_name,
        file_path = EXCLUDED.file_path,
        purpose = EXCLUDED.purpose,
        columns_json = EXCLUDED.columns_json,
        csv_content = EXCLUDED.csv_content,
        updated_at = EXCLUDED.updated_at
      RETURNING *
    `;

    const res = await pool.query(query, [
      datasetId,
      displayLabel,
      fileName,
      filePath || '',
      purpose || '',
      JSON.stringify(columns || []),
      csvContent || null,
      createdBy,
      now
    ]);

    const row = res.rows[0];
    const newConfig: DatasetConfig = {
      id: row.dataset_id,
      displayLabel: row.dataset_label,
      fileName: row.file_name,
      filePath: row.file_path,
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


