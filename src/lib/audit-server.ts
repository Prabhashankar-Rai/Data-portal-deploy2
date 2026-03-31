import fs from 'fs';
import path from 'path';

const AUDIT_FILE = path.join(process.cwd(), 'data', 'audit-logs.json');

export function getAuditLogs() {
  if (!fs.existsSync(AUDIT_FILE)) {
    if (!fs.existsSync(path.dirname(AUDIT_FILE))) {
      fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
    }
    fs.writeFileSync(AUDIT_FILE, JSON.stringify([]));
  }
  return JSON.parse(fs.readFileSync(AUDIT_FILE, 'utf-8'));
}

export function saveAuditLogs(logs: any) {
  if (!fs.existsSync(path.dirname(AUDIT_FILE))) {
    fs.mkdirSync(path.dirname(AUDIT_FILE), { recursive: true });
  }
  fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs, null, 2));
}

export function logServerAction(userRole: string, username: string | undefined, action: string, page?: string, details?: any) {
  try {
    const logs = getAuditLogs();
    logs.push({
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      userRole,
      username,
      action,
      page,
      details
    });
    saveAuditLogs(logs);
  } catch (err) {
    console.error('Failed to write server audit log:', err);
  }
}
