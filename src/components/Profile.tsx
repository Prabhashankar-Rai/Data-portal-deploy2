'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getClientRole } from '../lib/auth';
import { logAction } from '../lib/audit';

export default function Profile() {
  const [role, setRole] = useState<string | null>(null);
  const [userName, setUserName] = useState<string>('Loading...');
  const [userEmail, setUserEmail] = useState<string>('Loading...');
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    const cookies = document.cookie.split(';').reduce((acc, cookie) => {
      const [key, value] = cookie.trim().split('=');
      if (key && value) {
        try {
          acc[key] = decodeURIComponent(value);
        } catch {
          acc[key] = value;
        }
      }
      return acc;
    }, {} as Record<string, string>);

    setRole(cookies.role || null);
    setUserName(cookies.username || cookies.name || 'Unknown User');
    setUserEmail(cookies.user_id || cookies.email || 'unknown@example.com');
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handleLogout = async () => {
    const currentRole = role;
    document.cookie = "loggedIn=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "role=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "name=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "email=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "user_id=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    document.cookie = "username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
    if (currentRole) {
      logAction(currentRole, 'logout');
    }
    
    // Attempt to clear Tableau server session seamlessly by hitting its logout endpoint
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = 'https://analytics.pacificinsurance.com.my/auth/logout';
    document.body.appendChild(iframe);

    // Wait a brief moment for the request to fire before fully routing away
    // Trigger NextAuth signout
    try {
      const { signOut } = await import('next-auth/react');
      await signOut({ callbackUrl: '/login' });
    } catch {
      router.push('/login');
    }
  };

  const initial = userName && userName !== 'Unknown User' 
    ? userName.split(/[\s.]+/).map(n => n.charAt(0)).slice(0, 2).join('').toUpperCase() || 'U'
    : 'U';

  return (
    <div className="flex items-center gap-3">
      <div className="text-right">
        <div className="text-sm font-medium text-gray-900">{userName}</div>
        <div className="text-xs text-gray-500 uppercase">{role}</div>
      </div>
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center space-x-2 focus:outline-none"
        >
          <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center font-medium">
            {initial}
          </div>
        </button>
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10 border border-gray-200">
            <div className="px-4 py-2 text-sm text-gray-700 border-b border-gray-200">
              <div className="font-medium">{userName}</div>
              <div className="text-gray-500">{userEmail}</div>
            </div>
            <button
              onClick={handleLogout}
              className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
            >
              Logout
            </button>
          </div>
        )}
      </div>
    </div>
  );
}