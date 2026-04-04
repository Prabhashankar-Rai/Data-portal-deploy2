import { NextResponse } from 'next/server';
import { getAuditLogs, logServerAction } from '@/lib/audit-server';

export async function POST(req: Request) {
  try {
    const data = await req.json();
    // Await the log insertion from the DB to avoid race conditions 
    // or unhandled rejections in some server environments
    await logServerAction(data.userRole || 'UNKNOWN', data.username, data.action, data.page, data.details);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Failed to record audit log:', err);
    return NextResponse.json({ error: 'Failed to record audit log' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const logs = await getAuditLogs(); // getAuditLogs is now async
    return NextResponse.json(logs); // Already ordered by DB (DESC)
  } catch (err) {
    console.error('Failed to read audit logs:', err);
    return NextResponse.json({ error: 'Failed to read audit logs' }, { status: 500 });
  }
}
