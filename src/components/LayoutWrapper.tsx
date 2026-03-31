'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Sidebar from './Sidebar';
import Profile from './Profile';

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isLogin = pathname === '/login';
  
  // Default URL or dynamically extracted URL
  let tableauSrc = searchParams.get('url') || "https://analytics.pacificinsurance.com.my/";
  
  // Tableau iframe embedding sanitization
  if (tableauSrc.includes('analytics.pacificinsurance.com.my')) {
    // Remove the "/#/" fragment that breaks Tableau iframe embedding
    tableauSrc = tableauSrc.replace('/#/', '/');
    
    // Append standard Tableau Server embed parameters
    if (!tableauSrc.includes(':embed=')) {
      tableauSrc += (tableauSrc.includes('?') ? '&' : '?') + ':embed=yes&:showVizHome=no&:toolbar=bottom';
    }
  }

  return (
    <div className="flex min-h-screen bg-slate-50 transition-all duration-200">
      {!isLogin && <Sidebar />}
      <div className={`flex-1 flex flex-col min-w-0 ${!isLogin ? 'ml-64' : ''}`}>
        {!isLogin && (
          <header className="bg-white border-b border-gray-200 px-6 py-4 flex justify-end shrink-0 z-10">
            <Profile />
          </header>
        )}
        <main className="flex-1 flex flex-col relative overflow-hidden">
          <div className={pathname === '/ai-chat' ? 'flex-1 flex flex-col min-h-0' : `flex-1 overflow-auto p-6 space-y-6 ${pathname === '/tableau-dashboards' ? 'hidden' : 'block'}`}>
            {children}
          </div>
          
          {/* Persistent Tableau iframe instance */}
          {!isLogin && (
            <div className={`flex-1 flex-col bg-[#F5F7FB] p-6 ${pathname === '/tableau-dashboards' ? 'flex' : 'hidden'}`}>
              <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shrink-0">
                <div>
                  <h1 className="text-3xl font-extrabold tracking-tight text-blue-800">
                    Tableau Dashboards
                  </h1>
                  <p className="mt-2 text-sm text-gray-600">
                    Sign in to access and view your analytics.
                  </p>
                </div>
                <a
                  href="https://fairfaxasia.atlassian.net/servicedesk/customer/portals"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-700"
                >
                  Raise a Service Request
                  <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
        
              <div className="relative flex-1 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
                  <svg className="mb-4 h-16 w-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <h3 className="text-lg font-semibold text-gray-900">Embedding Blocked by Tableau Server</h3>
                  <p className="mt-2 text-sm text-gray-500 max-w-md">
                    The external Tableau server is refusing to connect inside the portal iframe due to its security settings (Clickjack protection / X-Frame-Options).
                  </p>
                  <a
                    href={tableauSrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-6 inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition-colors hover:bg-gray-50"
                  >
                    Open Dashboard Here
                  </a>
                </div>
        
                <iframe
                  src={tableauSrc}
                  className="relative z-10 h-full w-full border-none bg-white"
                  title="Tableau Dashboard"
                  allowFullScreen
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}