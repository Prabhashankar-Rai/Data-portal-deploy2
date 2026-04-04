import pool from './db';

/**
 * Fetches audit logs from the PostgreSQL database.
 * Returns latest logs first.
 */
export async function getAuditLogs() {
  try {
    const res = await pool.query('SELECT * FROM AuditLog ORDER BY timestamp DESC');
    return res.rows.map(row => ({
      ...row,
      userRole: row.user_role, // map snake_case to camelCase for UI compatibility
    }));
  } catch (err: any) {
    console.error('Failed to read audit logs from DB:', err.message || err);
    return [];
  }
}

/**
 * Logs a server action to the PostgreSQL database.
 * This is now asynchronous and much faster than file-based logging.
 */
export async function logServerAction(userRole: string, username: string | undefined, action: string, page?: string, details?: any) {
  try {
    // Map to the AuditLog table columns
    await pool.query(
      'INSERT INTO AuditLog (user_role, username, action, page, details) VALUES ($1, $2, $3, $4, $5)',
      [userRole, username, action, page, details]
    );
  } catch (err: any) {
    console.error('Failed to write server audit log to DB:', err.message || err);
  }
}

// Keep these for backward compatibility if any old code still uses them, 
// although they should be replaced by the async versions above.
export function saveAuditLogs(logs: any) {
  console.warn('saveAuditLogs (JSON) is deprecated. Use async logServerAction (DB) instead.');
}
