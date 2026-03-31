'use client';

import { useState, useEffect } from 'react';
import { getClientRole } from '@/lib/auth';

interface AuditLogEntry {
  id: string;
  timestamp: string;
  username?: string;
  userRole: string;
  action: string;
  page?: string;
  details?: any;
}

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState('');
  const [filterRole, setFilterRole] = useState('');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/audit');
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    if (filterAction && !log.action.toLowerCase().includes(filterAction.toLowerCase())) return false;
    if (filterRole && !log.userRole.toLowerCase().includes(filterRole.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200">
      <div className="p-6 border-b border-gray-200 bg-gray-50/50 rounded-t-2xl">
        <h2 className="text-xl font-bold text-gray-900">System Audit Logs</h2>
        <p className="mt-1 text-sm text-gray-500">
          Track and monitor all activities occurring across the portal.
        </p>
      </div>

      <div className="p-6 border-b border-gray-200 flex flex-wrap gap-4">
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-1">
            Filter by Action
          </label>
          <input
            type="text"
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            placeholder="e.g. login, create_user"
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-700 uppercase tracking-widest mb-1">
            Filter by Role
          </label>
          <input
            type="text"
            className="w-full rounded-lg border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
            placeholder="e.g. ADMIN, USER"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={fetchLogs}
            className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm transition-colors hover:bg-gray-200"
          >
            Refresh Logs
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm text-gray-600">
          <thead className="bg-gray-50 text-xs uppercase text-gray-500">
            <tr>
              <th className="px-6 py-4 font-medium tracking-wider">Timestamp</th>
              <th className="px-6 py-4 font-medium tracking-wider">User</th>
              <th className="px-6 py-4 font-medium tracking-wider">Role</th>
              <th className="px-6 py-4 font-medium tracking-wider">Action</th>
              <th className="px-6 py-4 font-medium tracking-wider">Page / Context</th>
              <th className="px-6 py-4 font-medium tracking-wider">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500">
                  <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-blue-600 border-r-transparent"></div>
                  <p className="mt-2">Loading logs...</p>
                </td>
              </tr>
            ) : filteredLogs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-8 text-center text-gray-500 font-medium">
                  No logs found.
                </td>
              </tr>
            ) : (
              filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                  <td className="whitespace-nowrap px-6 py-4 font-mono text-xs">
                    {new Date(log.timestamp).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-900">
                    {log.username || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                      log.userRole === 'ADMIN' ? 'bg-red-50 text-red-700 ring-red-600/10' : 'bg-blue-50 text-blue-700 ring-blue-600/10'
                    }`}>
                      {log.userRole}
                    </span>
                  </td>
                  <td className="px-6 py-4 font-medium text-gray-900">
                    {log.action}
                  </td>
                  <td className="px-6 py-4">
                    {log.page ? (
                      <span className="font-mono text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">{log.page}</span>
                    ) : (
                      <span className="text-gray-400 italic">N/A</span>
                    )}
                  </td>
                  <td className="px-6 py-4 max-w-xs truncate">
                    {log.details ? (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-800 font-medium">
                           {log.details.description ? log.details.description : 'View Raw Details'}
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-100 rounded border border-gray-200 overflow-x-auto text-[10px] whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    ) : (
                      <span className="text-gray-400 text-xs italic">N/A</span>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
