import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

const DATA_FILE = path.join(process.cwd(), 'data', 'datasets.json');

async function readDatasets(): Promise<any[]> {
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

async function writeDatasets(datasets: any[]) {
  await fs.mkdir(path.dirname(DATA_FILE), { recursive: true });
  await fs.writeFile(DATA_FILE, JSON.stringify(datasets, null, 2), 'utf8');
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const datasets = await readDatasets();
    const filtered = datasets.filter((d: any) => d.id !== id);
    
    if (filtered.length === datasets.length) {
      return NextResponse.json({ error: 'Dataset not found.' }, { status: 404 });
    }
    
    await writeDatasets(filtered);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to delete dataset.' },
      { status: 500 }
    );
  }
}
