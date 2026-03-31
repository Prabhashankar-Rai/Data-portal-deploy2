'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { getClientRole } from '../../lib/auth';
import { logAction } from '../../lib/audit';

export default function ServiceDesk() {
  const pathname = usePathname();

  useEffect(() => {
    const role = getClientRole();
    if (role) {
      logAction(role, 'page_visit', pathname);
    }
  }, [pathname]);

  return (
    <div className="-m-6 flex h-screen flex-col bg-[#F5F7FB] p-6 lg:h-[calc(100vh-theme(spacing.16))]">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-blue-800">
            Service Desk
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Submit and manage your support tickets and service requests.
          </p>
        </div>
        <a
          href="https://fairfaxasia.atlassian.net/servicedesk/customer/portals"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
        >
          Open in New Tab
          <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </div>

      <div className="relative flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        {/* Fallback Notice Layer (shows behind the iframe if it fails/blocks) */}
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
          <svg className="mb-4 h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <h3 className="text-lg font-semibold text-gray-900">Embedding Blocked by Atlassian Security</h3>
          <p className="mt-2 text-sm text-gray-500 max-w-md">
            The external Jira Service Desk server is refusing to connect inside the portal iframe due to its security settings (Clickjack protection / X-Frame-Options).
          </p>
          <a
            href="https://fairfaxasia.atlassian.net/servicedesk/customer/portals"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
          >
            Open Service Desk Here
          </a>
        </div>

        <iframe
          src="https://fairfaxasia.atlassian.net/servicedesk/customer/portals"
          className="relative z-10 h-full w-full border-none bg-white"
          title="Jira Service Desk"
          allowFullScreen
        />
      </div>
    </div>
  );
}