'use client';

import { useState, useEffect } from 'react';
import { signIn } from 'next-auth/react';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [urlError, setUrlError] = useState('');

  // Grab ?error= from the URL on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      const err = searchParams.get('error');
      if (err) setUrlError(`Authentication error: ${err}`);
    }
  }, []);

  const handleAzureLogin = async () => {
    setLoading(true);
    // Initiates the OAuth flow to Azure AD. Upon success, redirects the user to /api/auth/sync
    // to translate their tokens into the legacy cookie system for the portal APIs.
    await signIn('azure-ad', { callbackUrl: '/api/auth/sync' });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 relative overflow-hidden">
      {/* Dynamic Background */}
      <div className="absolute top-0 right-0 -m-32 w-[600px] h-[600px] bg-blue-100/50 rounded-full blur-3xl opacity-50 mix-blend-multiply flex animate-pulse" />
      <div className="absolute bottom-0 left-0 -m-32 w-[600px] h-[600px] bg-indigo-100/50 rounded-full blur-3xl opacity-50 mix-blend-multiply flex animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="bg-white p-10 rounded-3xl shadow-2xl w-full max-w-md relative z-10 border border-white/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-8 duration-700">
        <div className="mb-10 text-center">
          <div className="h-16 w-16 bg-blue-600 text-white rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-blue-200 mb-6 rotate-3">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.071 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path></svg>
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Access Portal</h1>
          <p className="text-sm font-medium text-gray-400 mt-2 tracking-wide">Enter valid registered profile email or username</p>
        </div>

        {urlError && (
          <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100 flex items-start animate-in fade-in duration-300">
            <svg className="w-5 h-5 mr-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
            {urlError}
          </div>
        )}

        <div className="space-y-6">
          <button
            onClick={handleAzureLogin}
            disabled={loading}
            className={`w-full text-white px-4 py-3 cursor-pointer rounded-xl font-bold shadow-md shadow-blue-200 transition-all ${loading ? 'bg-blue-400' : 'bg-[#0078d4] hover:bg-[#106ebe] hover:shadow-xl active:scale-95'} flex justify-center items-center gap-2`}
          >
            {loading ? (
              <span className="flex items-center gap-2">
                 <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Redirecting...
              </span>
            ) : (
              <>
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 22 22">
                  <path d="M10.5 0v10.5H0V0h10.5z" fill="#f25022"/>
                  <path d="M22 0v10.5H11.5V0H22z" fill="#7fba00"/>
                  <path d="M10.5 11.5V22H0V11.5h10.5z" fill="#00a4ef"/>
                  <path d="M22 11.5V22H11.5V11.5H22z" fill="#ffb900"/>
                </svg>
                Sign in with Microsoft
              </>
            )}
          </button>
        </div>
        
        <div className="mt-8 text-center text-xs text-gray-400">
           Secured by Microsoft Entra ID with Global Multi-Factor Authentication
        </div>
      </div>
    </div>
  );
}