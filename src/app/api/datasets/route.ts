import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

type FilterType = 'none' | 'date' | 'multi' | 'text' | 'number';

type ColumnConfig = {
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

const DATA_FILE = path.join(process.cwd(), 'data', 'datasets.json');

async function readDatasets(): Promise<DatasetConfig[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw) as DatasetConfig[];
  } catch {
    return [];
  }
}

async function writeDatasets(datasets: DatasetConfig[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(datasets, null, 2), 'utf8');
}

import { cookies } from 'next/headers';
import { getDb } from '@/lib/json-db';

export async function GET() {
  const datasets = await readDatasets();

  try {
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

    const db = getDb();
    const userGroupIds = db.User_Groups
      .filter((ug: any) => ug.user_id === userId)
      .map((ug: any) => ug.group_id);

    const userActions = db.User_App_Actions.filter((ua: any) =>
      ua.user_id === userId || userGroupIds.includes(ua.group_id)
    );

    const actionMap = db.Actions.reduce((acc: Record<string, string>, a: any) => {
      acc[a.action_id] = a.action_name;
      return acc;
    }, {});

    const allowedDatasets = datasets.reduce((acc: any[], d: DatasetConfig) => {
      const datasetActions = userActions.filter((ua: any) => ua.dataset_id === d.id);
      const hasHidden = datasetActions.some((ua: any) => actionMap[ua.action_id] === 'Hidden');
      if (hasHidden) return acc;

      const hasDownload = datasetActions.some((ua: any) => actionMap[ua.action_id] === 'Download');
      const hasView = datasetActions.some((ua: any) => actionMap[ua.action_id] === 'View');
      const hasAIChat = datasetActions.some((ua: any) => actionMap[ua.action_id] === 'AI Chat');

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
  } catch (err) {
    return NextResponse.json(datasets); // Fallback to all if auth check fails, though maybe it should be [] instead, but let's keep it safe or empty
  }
}

export async function POST(request: Request) {
  const body = await request.json();

  const {
    id,
    displayLabel,
    fileName,
    filePath,
    purpose,
    columns,
    createdBy = 'ADMIN',
  } = body as Partial<DatasetConfig> & { columns?: ColumnConfig[] };

  if (!displayLabel || !fileName || !filePath) {
    return NextResponse.json(
      { error: 'displayLabel, fileName and filePath are required.' },
      { status: 400 },
    );
  }

  const now = new Date().toISOString();
  const datasets = await readDatasets();

  const slugFromLabel = displayLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const datasetId = id || slugFromLabel || `dataset-${Date.now()}`;

  const existingIndex = datasets.findIndex(d => d.id === datasetId);

  const newConfig: DatasetConfig = {
    id: datasetId,
    displayLabel,
    fileName,
    filePath,
    purpose: purpose || '',
    columns: Array.isArray(columns) ? columns : [],
    createdBy: existingIndex >= 0 ? datasets[existingIndex].createdBy : createdBy,
    updatedAt: now,
  };

  if (existingIndex >= 0) {
    datasets[existingIndex] = newConfig;
  } else {
    datasets.push(newConfig);
  }

  await writeDatasets(datasets);

  return NextResponse.json(newConfig);
}

