import { NextResponse } from 'next/server';
import { createReadStream } from 'fs';
import readline from 'readline';

function clean(value: string) {
  return value.trim().replace(/^"(.*)"$/, '$1');
}

export async function POST(request: Request) {
  const { filePath, csvContent } = (await request.json()) as { filePath?: string, csvContent?: string };

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
      const fileStream = createReadStream(filePath, 'utf8');
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
