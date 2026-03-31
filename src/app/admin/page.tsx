'use client';

import { useEffect, useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function AdminDashboard() {
  const [stats, setStats] = useState({ users: 0, groups: 0 });

  useEffect(() => {
    // We fetch some light data to make the dashboard look alive
    const fetchStats = async () => {
      try {
        const [usersRes, groupsRes] = await Promise.all([
          fetch('/api/users'),
          fetch('/api/groups')
        ]);
        const usersData = await usersRes.json();
        const groupsData = await groupsRes.json();

        setStats({
          users: usersData.data?.length || 0,
          groups: groupsData.data?.length || 0
        });
      } catch (e) {
        console.error("Could not load stats");
      }
    };
    fetchStats();
  }, []);

  // Fake traffic data for aesthetics 
  const data = [
    { name: 'Mon', traffic: 4000 },
    { name: 'Tue', traffic: 3000 },
    { name: 'Wed', traffic: 2000 },
    { name: 'Thu', traffic: 2780 },
    { name: 'Fri', traffic: 1890 },
    { name: 'Sat', traffic: 2390 },
    { name: 'Sun', traffic: 3490 },
  ];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Admin Overview</h1>
        <p className="text-gray-500 mt-1">Welcome to your central administration hub.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Total Users</p>
            <p className="text-2xl font-semibold">{stats.users}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.071 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4"></path></svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Access Groups</p>
            <p className="text-2xl font-semibold">{stats.groups}</p>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm hover:shadow-lg transition-all duration-200 p-6 flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-100 text-blue-600">
            <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"></path></svg>
          </div>
          <div>
            <p className="text-sm text-gray-500">Active Datasets</p>
            <p className="text-2xl font-semibold">4</p>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm p-6">
        <h2 className="text-lg font-semibold mb-4">Portal Activity</h2>
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorTraffic" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6B7280', fontSize: 12 }} dx={-10} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }}
              />
              <Area type="monotone" dataKey="traffic" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorTraffic)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

    </div>
  );
}