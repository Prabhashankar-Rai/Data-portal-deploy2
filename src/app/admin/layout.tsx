'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();

    const navLinks = [
        { name: 'Dashboard', href: '/admin' },
        { name: 'User Configuration', href: '/admin/users' },
        { name: 'Group Configuration', href: '/admin/groups' },
        { name: 'User Module Access', href: '/admin/access' },
        { name: 'Registered Datasets', href: '/admin/datasets' },
        { name: 'User App Actions', href: '/admin/actions' },
        { name: 'User Access Filters', href: '/admin/filters' },
        { name: 'System Audit Logs', href: '/admin/audit-logs' },
    ];

    return (
        <div className="flex min-h-screen bg-slate-50 overflow-hidden transition-all duration-200">
            {/* Sidebar */}
            <aside className="w-72 bg-white border-r border-gray-200 flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-800 tracking-tight">Admin Center</h2>
                    <p className="text-sm text-gray-500 mt-1">Manage portal settings</p>
                </div>
                <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
                    {navLinks.map((link) => {
                        const isActive = pathname === link.href || (pathname.startsWith(link.href) && link.href !== '/admin');
                        return (
                            <Link
                                key={link.name}
                                href={link.href}
                                className={`flex items-center px-4 py-3 text-sm font-medium rounded-xl transition-all duration-200 ${isActive
                                    ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                                    : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                                    }`}
                            >
                                {link.name}
                            </Link>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-y-auto w-full">
                <div className="p-8 max-w-[1400px] mx-auto space-y-6">
                    {children}
                </div>
            </main>
        </div>
    );
}
