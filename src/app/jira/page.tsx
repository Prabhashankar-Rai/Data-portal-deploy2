'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getClientRole } from '../../lib/auth';
import { logAction } from '../../lib/audit';

export default function Jira() {
  const pathname = usePathname();

  useEffect(() => {
    const role = getClientRole();
    if (role) {
      logAction(role, 'page_visit', pathname);
    }
  }, [pathname]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">Jira Requests</h1>
      <p>Placeholder for Jira integration and request management</p>
    </div>
  );
}