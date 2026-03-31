import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import readline from 'readline';

function clean(value: string) {
  return value.trim().replace(/^"(.*)"$/, '$1');
}

export async function POST(request: Request) {
  const { filePath } = (await request.json()) as { filePath?: string };

  if (!filePath) {
    return NextResponse.json(
      { error: 'filePath is required' },
      { status: 400 },
    );
  }

  try {
    const fileStream = createReadStream(filePath, 'utf8');
    const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });
    
    let firstLine = '';
    for await (const line of rl) {
      if (line.trim()) {
        firstLine = line;
        break; // Stop reading after the first non-empty line
      }
    }
    rl.close();
    fileStream.destroy();

    const columns = firstLine.split(',').map(clean).filter((c: string) => c.length > 0);
    return NextResponse.json({ columns });
  } catch (error: any) {
    return NextResponse.json(
      { error: `Unable to read file: ${error?.message || String(error)}` },
      { status: 500 },
    );
  }
}
