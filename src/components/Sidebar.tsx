'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';

// Static Module definitions - names MUST match your Administration portal exactly
const allMenuItems = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'AI Chat', href: '/ai-chat' },
  { name: 'Tableau Dashboards', href: '/tableau-dashboards' },
  { name: 'Data Download', href: '/download' },
  { name: 'ETL Reports', href: '/etl-reports' },
];

const adminMenuItems = [
  { name: 'Administration', href: '/admin' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const fetchAuth = async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();

        if (data.authenticated) {
          setRole(data.role);
          setAuthorized(data.authorizedModules || []);
          setUsername(data.username || '');
        } else {
          // Unauthenticated logic handled mostly by individual pages
          setRole(null);
          setAuthorized([]);
        }
      } catch (err) {
        console.error("Auth check failed:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchAuth();
  }, []);

  const handleLogout = async () => {
    document.cookie = 'loggedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    document.cookie = 'username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
    try {
      const { signOut } = await import('next-auth/react');
      await signOut({ callbackUrl: '/login' });
    } catch {
      window.location.href = '/login';
    }
  };

  // Filter items matching the backend response. Global "ADMIN" sees everything naturally.
  const visibleMenuItems = allMenuItems.filter(item =>
    role === 'ADMIN' || authorized.includes(item.name)
  );

  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 text-white h-full fixed left-0 top-0 flex flex-col shadow-xl transition-all duration-200">
      <div className="p-6">
        <h2 className="text-xl font-extrabold text-white tracking-tight flex items-center gap-2">
          <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"></path></svg>
          Data Portal
        </h2>
      </div>

      <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-8">
        {!loading && role && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 pl-3">Your Modules</h3>
            {visibleMenuItems.length > 0 ? (
              <ul className="space-y-1">
                {visibleMenuItems.map((item) => {
                  const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== '/');
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'}`}
                      >
                        {item.name}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="text-xs text-gray-500 pl-3 italic">
                No modules explicitly granted by admin.
              </div>
            )}
          </div>
        )}

        {role === 'ADMIN' && (
          <div>
            <h3 className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-3 pl-3">System</h3>
            <ul className="space-y-1">
              {adminMenuItems.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${isActive ? 'bg-blue-600 text-white shadow' : 'text-slate-300 hover:bg-slate-700/40 hover:text-white'}`}
                    >
                      <svg className="w-4 h-4 opacity-70" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </nav>

      {/* Profile Section */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        {!loading && role ? (
          <div className="flex items-center justify-between group">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium flex-shrink-0 tracking-widest">
                {username ? username.split(/[\s.]+/).map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase() : '?'}
              </div>
              <div className="truncate">
                <div className="text-sm font-semibold text-white truncate">{username || 'Unknown User'}</div>
                <div className="text-xs text-slate-400 capitalize">{role.toLowerCase()} Profile</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              title="Logout"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"></path></svg>
            </button>
          </div>
        ) : (
          <div className="h-10 animate-pulse bg-gray-800 rounded-lg w-full"></div>
        )}
      </div>

    </div>
  );
}