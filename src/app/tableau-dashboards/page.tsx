'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getClientRole } from '../../lib/auth';
import { logAction } from '../../lib/audit';

export default function TableauDashboards() {
  const pathname = usePathname();

  useEffect(() => {
    const role = getClientRole();
    if (role) {
      logAction(role, 'page_visit', pathname);
    }
  }, [pathname]);

  return null;
}