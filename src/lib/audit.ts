export interface AuditLog {
  userRole: string;
  action: string;
  timestamp: string;
  page?: string;
  details?: any;
}

export async function logAction(userRole: string, action: string, page?: string, details?: any) {
  try {
    await fetch('/api/audit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userRole,
        action,
        page,
        details,
      }),
    });
  } catch (err) {
    console.error('Failed to log action:', err);
  }
}