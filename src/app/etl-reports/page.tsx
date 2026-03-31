'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getClientRole } from '../../lib/auth';
import { logAction } from '../../lib/audit';

export default function ETLReports() {
  const pathname = usePathname();

  useEffect(() => {
    const role = getClientRole();
    if (role) {
      logAction(role, 'page_visit', pathname);
    }
  }, [pathname]);

  return (
    <div>
      <h1 className="text-3xl font-bold mb-4">ETL Reports</h1>
      <p>Placeholder for ETL process reports and monitoring</p>
    </div>
  );
}