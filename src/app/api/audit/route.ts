import { NextResponse } from 'next/server';
import { getAuditLogs, logServerAction } from '@/lib/audit-server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    logServerAction(data.userRole || 'UNKNOWN', data.username, data.action, data.page, data.details);
    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to record audit log' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const logs = getAuditLogs();
    return NextResponse.json(logs.reverse()); // latest first
  } catch (err) {
    return NextResponse.json({ error: 'Failed to read audit logs' }, { status: 500 });
  }
}

