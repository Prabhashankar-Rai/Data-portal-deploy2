'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { getClientRole } from '../../lib/auth';
import { logAction } from '../../lib/audit';
import ReactMarkdown from 'react-markdown';
import Link from 'next/link';
import html2canvas from 'html2canvas';

import {
    BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

type Message = {
    role: 'user' | 'assistant';
    content: string;
    has_data?: boolean;
    df?: any[];
    chart_type?: "bar" | "line" | "pie" | "none" | "comparison" | string;
    sql_query?: string;
    explanation?: string;
    recommendation?: string;
    follow_up_questions?: string[];
    execution_time_ms?: number;
    filters_applied?: any[];
};

const COLORS = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd', '#8c564b', '#e377c2', '#7f7f7f', '#bcbd22', '#17becf'];

function formatMetric(value: any, columnName: string = '') {
    if (typeof value === 'number') {
        const lowerCol = columnName.toLowerCase();
        const isRatio = ['ratio', 'rate', 'growth', 'achievement', 'margin', '%', 'percentage'].some(kw => lowerCol.includes(kw));
        const isPlainNumber = ['year', 'id', 'rank', 'month', 'count', 'no_of'].some(kw => lowerCol.includes(kw));

        if (isPlainNumber) {
            return value.toString();
        }
        
        if (isRatio) {
            return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(value)}%`;
        }
        return `RM ${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
    }
    return value;
}

function DataVisualization({ msg }: { msg: Message }) {
    if (!msg.has_data || !msg.df || msg.df.length === 0) return null;

    const data = msg.df;
    const columns = Object.keys(data[0]);

    // Check if it's a top agents ranking
    let isTopAgents = false;
    let rankData = [];
    if (columns.length === 2) {
        const firstCol = columns[0].toLowerCase();
        if (firstCol.includes('agent') && typeof data[0][columns[1]] === 'number') {
            isTopAgents = true;
            rankData = data.map((row, idx) => ({ ...row, Rank: idx + 1, AgentID: String(row[columns[0]]), Value: row[columns[1]] }));
        }
    }

    // Check if it is a multi-year comparison grouping
    let isComparison = msg.chart_type === 'comparison';
    let yearCols: string[] = [];
    let xCol = columns[0];
    const numericCols = columns.filter(c => typeof data[0][c] === 'number');

    if (isComparison || yearCols.length >= 2) {
        yearCols = columns.filter(c => /20\d{2}/.test(c));
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (columns.some(c => c.toLowerCase().includes('month'))) {
            xCol = columns.find(c => c.toLowerCase().includes('month')) || columns[0];
            data.sort((a, b) => monthOrder.indexOf(a[xCol]) - monthOrder.indexOf(b[xCol]));
        }
        isComparison = true;
    }

    return (
        <div className="mt-4 space-y-6">
            {/* Table View */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col max-h-[400px]">
                <div className="bg-gray-50 px-4 py-3 border-b border-gray-200 flex items-center justify-between shrink-0">
                    <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">📋 Data Table</h3>
                    <div className="flex gap-2">
                        <button
                            onClick={async () => {
                                const tsv = [columns.join("\t")].concat(data.map(r => columns.map(c => r[c]).join("\t"))).join("\n");
                                await navigator.clipboard.writeText(tsv);
                                alert("Data copied to clipboard!");
                            }}
                            className="text-xs bg-white text-gray-700 font-medium px-2 py-1 rounded shadow-sm border border-gray-300 hover:bg-gray-100 transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"></path></svg>
                            Copy Data
                        </button>
                        <button
                            onClick={() => {
                                const csvContent = [columns.join(",")].concat(data.map(r => columns.map(c => `"${r[c]}"`).join(","))).join("\n");
                                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a'); a.href = url; a.download = 'analytics-export.csv'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
                            }}
                            className="text-xs bg-indigo-50 text-indigo-700 font-medium px-2 py-1 rounded shadow-sm border border-indigo-200 hover:bg-indigo-100 transition-colors flex items-center gap-1.5"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
                            Export CSV
                        </button>
                    </div>
                </div>
                <div className="overflow-auto flex-1 custom-scrollbar relative">
                    <table className="min-w-full text-left text-sm">
                        <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                            <tr>
                                {isTopAgents && <th className="px-4 py-2 font-semibold text-gray-600 border-b">Rank</th>}
                                {columns.map(col => (
                                    <th key={col} className="px-4 py-2 font-semibold text-gray-600 border-b whitespace-nowrap">{col}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {data.map((row, idx) => (
                                <tr key={idx} className="hover:bg-gray-50/50">
                                    {isTopAgents && <td className="px-4 py-2 font-medium text-gray-500">{idx + 1}</td>}
                                    {columns.map(col => (
                                        <td key={`${idx}-${col}`} className="px-4 py-2 text-gray-800 whitespace-nowrap">
                                            {typeof row[col] === 'number' ? formatMetric(row[col], col) : row[col]}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Chart View */}
            {msg.chart_type !== 'none' && numericCols.length > 0 && (
                <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden p-4 relative group">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-gray-700">📊 Visualization</h3>
                        <button
                            onClick={async (e) => {
                                const btn = e.currentTarget;
                                const originalText = btn.innerHTML;
                                btn.innerHTML = '📸 Capturing...';

                                try {
                                    // Target strictly the chart container explicitly
                                    const target = btn.closest('.group')?.querySelector('.recharts-responsive-container')?.parentElement as HTMLElement;
                                    if (!target) throw new Error("Chart container not found");

                                    const canvas = await html2canvas(target, { backgroundColor: '#ffffff', scale: 2 });
                                    const imgData = canvas.toDataURL('image/png');

                                    const link = document.createElement('a');
                                    link.href = imgData;
                                    link.download = `chart-export-${new Date().getTime()}.png`;
                                    link.click();
                                } catch (err) {
                                    console.error("Capture failed:", err);
                                    alert("Failed to capture chart. Please try again.");
                                } finally {
                                    btn.innerHTML = originalText;
                                }
                            }}
                            className="text-xs bg-emerald-50 text-emerald-700 font-medium px-2.5 py-1.5 rounded-lg shadow-sm border border-emerald-200 hover:bg-emerald-100 transition-colors flex items-center gap-1.5 z-20"
                        >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Save as Image
                        </button>
                    </div>
                    <div className="h-[400px] w-full" style={{ background: 'white' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {msg.chart_type === 'pie' && numericCols.length === 1 ? (
                                <PieChart>
                                    <Pie
                                        data={data}
                                        dataKey={numericCols[0]}
                                        nameKey={columns[0]}
                                        cx="50%" cy="50%"
                                        outerRadius={130}
                                        fill="#8884d8"
                                        label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                                    >
                                        {data.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(value: any, name: any) => formatMetric(value, String(name))} />
                                    <Legend />
                                </PieChart>
                            ) : msg.chart_type === 'line' ? (
                                <LineChart data={data} margin={{ top: 20, right: 30, left: 40, bottom: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey={xCol} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                                    <YAxis tickFormatter={(val) => numericCols.some(c => ['ratio','rate','growth','%'].some(kw => c.toLowerCase().includes(kw))) ? `${val}%` : `RM ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(value: any, name: any) => formatMetric(value, String(name))} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {numericCols.map((col, idx) => (
                                        <Line key={col} type="monotone" dataKey={col} stroke={COLORS[idx % COLORS.length]} strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} />
                                    ))}
                                </LineChart>
                            ) : (
                                <BarChart data={isTopAgents ? rankData : data} margin={{ top: 20, right: 30, left: 40, bottom: 20 }} barSize={32}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                    <XAxis dataKey={isTopAgents ? "AgentID" : xCol} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={{ stroke: '#E5E7EB' }} />
                                    <YAxis tickFormatter={(val) => numericCols.some(c => ['ratio','rate','growth','%'].some(kw => c.toLowerCase().includes(kw))) ? `${val}%` : `RM ${(val / 1000).toFixed(0)}k`} tick={{ fontSize: 12, fill: '#6B7280' }} tickLine={false} axisLine={false} />
                                    <Tooltip formatter={(value: any, name: any) => formatMetric(value, String(name))} cursor={{ fill: '#F3F4F6' }} contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }} />
                                    <Legend wrapperStyle={{ paddingTop: '20px' }} />
                                    {isComparison ? yearCols.map((col, idx) => (
                                        <Bar key={col} dataKey={col} fill={COLORS[idx % COLORS.length]} radius={[4, 4, 0, 0]} />
                                    )) : numericCols.map((col, idx) => (
                                        <Bar key={col} dataKey={isTopAgents ? "Value" : col} name={col} fill={COLORS[idx % COLORS.length]} radius={[4, 4, 0, 0]} />
                                    ))}
                                </BarChart>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AIChat() {
    const pathname = usePathname();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [loadingStage, setLoadingStage] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const [expandedSqlIdx, setExpandedSqlIdx] = useState<number | null>(null);
    const [role, setRole] = useState<string | null>(null);
    const [tokenUsage, setTokenUsage] = useState<number>(0);
    const [tokenLimit, setTokenLimit] = useState<number>(10000);
    const [chatHistory, setChatHistory] = useState<any[]>([]);
    const [datasets, setDatasets] = useState<any[]>([]);
    const [selectedDatasetId, setSelectedDatasetId] = useState<string>('');
    const [isInitialized, setIsInitialized] = useState(false);

    // Initial data fetch
    useEffect(() => {
        const fetchUserData = async () => {
            try {
                const histRes = await fetch('/api/chat-history');
                const histData = await (histRes.ok ? histRes.json() : { history: [] });
                if (histData.history) setChatHistory(histData.history);

                const tokenRes = await fetch('/api/token-usage');
                const tokenData = await (tokenRes.ok ? tokenRes.json() : { quota: { tokens_used: 0, limit: 100000 } });
                if (tokenData.quota) {
                    setTokenUsage(tokenData.quota.tokens_used);
                    setTokenLimit(tokenData.quota.limit);
                }

                const dataRes = await fetch('/api/datasets');
                if (dataRes.ok) {
                    const d = await dataRes.json();
                    const aiDatasets = d.filter((ds: any) => ds.hasAIChat);
                    setDatasets(aiDatasets);
                    if (aiDatasets.length > 0) setSelectedDatasetId(aiDatasets[0].id);
                }
            } catch (e) { console.error('Error fetching chat history/quota', e) }
            setIsInitialized(true);
        };
        fetchUserData();
    }, []);

    const SUGGESTIONS = [
        "What is total GWP for year 2025?",
        "Compare GWP 2024 vs 2025 by month",
        "Show me top 5 agents by GWP for year 2025",
        "What is total risk sum insured across branches?"
    ];

    useEffect(() => {
        const clientRole = getClientRole();
        setRole(clientRole);
        if (clientRole) {
            logAction(clientRole, 'page_visit', pathname);
        }
    }, [pathname]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (text: string) => {
        if (!text.trim() || isLoading) return;

        const userMessage = { role: 'user' as const, content: text.trim() };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);
        setLoadingStage('Generating SQL Query...');

        try {
            const apiMessages = [...messages, userMessage].map(m => ({
                role: m.role,
                content: m.content
            }));

            // Step 1: Open AI SQL Generation
            const genResponse = await fetch('/api/generate-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    messages: apiMessages,
                    datasetId: selectedDatasetId
                })
            });

            const genData = await genResponse.json();

            if (!genResponse.ok) {
                setMessages(prev => [...prev, { role: 'assistant', content: genData.error || 'Failed to generate query' }]);
                setIsLoading(false);
                return;
            }

            if (genData.usage && genData.usage.total_tokens) {
                setTokenUsage(prev => prev + genData.usage.total_tokens);
            }

            setLoadingStage('Executing SQL & Generating Insights...');

            // Step 2: DuckDB CSV Execution and Narration
            const execResponse = await fetch('/api/run-csv-query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sql_query: genData.sql_query,
                    question: text.trim(),
                    datasetId: selectedDatasetId
                })
            });

            const execData = await execResponse.json();

            if (!execResponse.ok) {
                setMessages(prev => [...prev, { role: 'assistant', content: `**Error executing data:** ${execData.error}` }]);
            } else {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    content: execData.explanation || 'Query executed successfully.',
                    has_data: execData.df && execData.df.length > 0,
                    df: execData.df,
                    chart_type: genData.suggested_chart,
                    sql_query: genData.sql_query,
                    explanation: execData.explanation,
                    recommendation: execData.recommendation,
                    follow_up_questions: genData.follow_up_questions,
                    execution_time_ms: execData.execution_time_ms,
                    filters_applied: execData.filters_applied
                }]);

                // Refresh chat history locally
                setChatHistory([{
                    user_id: "Me",
                    timestamp: new Date().toISOString(),
                    user_question: text.trim(),
                    tokens_used: execData.tokens_used + (genData.usage?.total_tokens || 0)
                }, ...chatHistory]);

                if (execData.tokens_used) {
                    setTokenUsage(prev => prev + execData.tokens_used);
                }
            }
        } catch (error: any) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'assistant', content: '**Error:** Network issue occurred while processing.' }]);
        } finally {
            setIsLoading(false);
            setLoadingStage('');
        }
    };

    return (
        <div className="flex-1 flex w-full h-full bg-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 bg-[#f8f9fa] border-r border-gray-200 flex flex-col shrink-0">
                <div className="p-6">
                    <div className="flex items-center gap-3 text-indigo-900 font-semibold mb-2 text-lg">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"></path></svg>
                        User
                    </div>
                    <div className="text-sm text-gray-600 mb-6">
                        <span className="font-semibold">Role:</span> {role === 'ADMIN' ? 'Admin' : 'User'}
                    </div>
                </div>

                <div className="px-5 border-t border-gray-200 pt-5">
                    <div className="flex items-center justify-between mb-3 text-sm">
                        <div className="flex items-center gap-1.5 text-gray-700 font-semibold">
                            <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                            History
                        </div>
                    </div>
                    <div className="space-y-2 overflow-y-auto max-h-[30vh] pr-1 custom-scrollbar">
                        {chatHistory.length === 0 ? (
                            <div className="text-[11px] text-gray-400 italic">No previous chats.</div>
                        ) : (
                            chatHistory.map((hist, idx) => (
                                <div key={idx} className="bg-white p-2.5 rounded-lg shadow-sm border border-gray-100 flex flex-col gap-0.5 cursor-pointer hover:border-indigo-300 transition-colors">
                                    <div className="text-[11px] font-semibold text-gray-700 line-clamp-1">{hist.user_question}</div>
                                    <div className="flex items-center justify-between mt-1 text-[9px] text-gray-400">
                                        <span>{new Date(hist.timestamp).toLocaleDateString()}</span>
                                        <span className="bg-gray-50 px-1 py-0.5 rounded text-gray-400 font-mono">{hist.tokens_used} tok</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="px-5 border-t border-gray-200 mt-5 pt-5 flex-1">
                    <div className="flex flex-col mb-6">
                        <label className="text-xs font-semibold text-gray-700 mb-1.5 flex items-center gap-1.5"><span className="text-sm">🗂️</span> Dataset Context</label>
                        {datasets.length > 0 ? (
                            <div className="relative">
                                <select
                                    value={selectedDatasetId}
                                    onChange={(e) => setSelectedDatasetId(e.target.value)}
                                    className="w-full appearance-none bg-white border border-gray-200 rounded-md pl-2 pr-8 py-1.5 text-gray-700 shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 transition-shadow text-xs font-medium"
                                >
                                    {datasets.map(ds => (
                                        <option key={ds.id} value={ds.id}>{ds.displayLabel}</option>
                                    ))}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-400">
                                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                                </div>
                            </div>
                        ) : (
                            <div className="text-[10px] text-red-500 font-medium">No datasets enabled.</div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5 text-gray-700 font-semibold mb-2 text-xs">
                        <span>📊</span> Usage
                    </div>
                    <div className="text-xs font-semibold text-gray-500 mb-2">
                        {new Intl.NumberFormat().format(tokenUsage)} / {new Intl.NumberFormat().format(tokenLimit)}
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2.5">
                        <div className={`h-2.5 rounded-full ${tokenUsage > (tokenLimit * 0.9) ? 'bg-red-500' : 'bg-indigo-600'}`} style={{ width: `${Math.min((tokenUsage / tokenLimit) * 100, 100)}%` }}></div>
                    </div>
                </div>


                <div className="p-6 border-t border-gray-200 space-y-3">
                    <button
                        onClick={() => { setMessages([]); setTokenUsage(0); }}
                        className="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                        <span className="text-blue-500">🔄</span> New Chat
                    </button>
                    <button
                        className="w-full py-2 px-4 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
                    >
                        <span className="text-orange-500">🚪</span> Logout
                    </button>
                </div>
            </div>

            {/* Main Chat Area */}
            <div className="flex-1 flex flex-col bg-white min-w-0 h-full relative overflow-hidden">
                <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-8 space-y-8 scroll-smooth custom-scrollbar">
                    {!isInitialized ? null : messages.length === 0 ? (
                        <div className="max-w-4xl mx-auto w-full pt-12">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center text-2xl shadow-sm shrink-0">🏛️</div>
                                <h1 className="text-3xl font-extrabold text-[#3b4151] tracking-tight">Insurance Analytics Assistant</h1>
                            </div>

                            <h2 className="text-xl font-bold text-[#3b4151] mb-6 flex items-center gap-2">
                                <span className="text-2xl animate-wave origin-bottom-right drop-shadow-sm">👋</span> Hello, how can I help you today?
                            </h2>


                            {datasets.length === 0 && (
                                <div className="mb-8 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                    <p className="text-sm font-medium text-yellow-800">
                                        No datasets are currently enabled for AI Chat. Please ask your administrator to enable datasets for AI in the Admin panel.
                                    </p>
                                </div>
                            )}

                            <p className="text-sm font-bold text-gray-600 mb-4">Try these questions:</p>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {SUGGESTIONS.map((suggestion, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => handleSend(suggestion)}
                                        disabled={isLoading}
                                        className="text-left px-5 py-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-md transition-all text-sm font-medium text-gray-700 flex items-center gap-3 disabled:opacity-50"
                                    >
                                        <span className="text-lg shrink-0 text-blue-500">🔍</span>
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        </div>
                    ) : (
                        messages.map((msg, idx) => (
                            <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-4xl w-full ${msg.role === 'user' ? 'lg:max-w-3xl ml-auto' : 'mr-auto'}`}>
                                    {msg.role === 'assistant' && msg.has_data && msg.sql_query && (
                                        <div className="mb-3">
                                            <button
                                                onClick={() => setExpandedSqlIdx(expandedSqlIdx === idx ? null : idx)}
                                                className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1 bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 transition-colors"
                                            >
                                                <svg className={`w-3.5 h-3.5 transition-transform ${expandedSqlIdx === idx ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                                                {expandedSqlIdx === idx ? 'Hide SQL & Security Context' : 'View Generated SQL & Security Context'}
                                            </button>
                                            {expandedSqlIdx === idx && (
                                                <div className="mt-2 space-y-2">
                                                    <div className="bg-[#1e1e1e] text-indigo-300 p-3 rounded-lg text-xs font-mono overflow-x-auto border border-gray-800 shadow-inner">
                                                        <div className="text-gray-500 mb-1 border-b border-gray-700 pb-1 flex items-center justify-between">
                                                            <span>// AI Generated Query</span>
                                                            {msg.execution_time_ms && <span className="text-gray-400">Execution time: {msg.execution_time_ms}ms</span>}
                                                        </div>
                                                        {msg.sql_query}
                                                    </div>

                                                    {msg.filters_applied && msg.filters_applied.length > 0 && (
                                                        <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-lg flex flex-col gap-2 shadow-sm">
                                                            <div className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
                                                                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"></path></svg>
                                                                Enterprise Security Access Matrix Applied
                                                            </div>
                                                            <div className="flex flex-wrap gap-1.5">
                                                                {msg.filters_applied.map((f: any, fIdx: number) => (
                                                                    <span key={fIdx} className="px-2 py-0.5 bg-emerald-100 text-emerald-700 border border-emerald-300 rounded text-[10px] font-mono whitespace-nowrap">
                                                                        {f.column_name} {f.operator} '{f.element_value}'
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    <div className={`rounded-2xl px-6 py-5 ${msg.role === 'user' ? 'bg-[#f0f2f6] text-gray-800 border border-gray-200 rounded-br-sm shadow-sm' : 'bg-white border text-gray-800 shadow-sm rounded-bl-sm'} ${msg.has_data ? 'w-full' : 'inline-block'}`}>
                                        {msg.role === 'assistant' ? (
                                            <div className="space-y-4 w-full">
                                                {msg.has_data ? (
                                                    <>
                                                        {msg.explanation && (
                                                            <div className="prose prose-sm prose-indigo max-w-none text-[15px] leading-relaxed mb-6 font-sans">
                                                                <ReactMarkdown>{msg.explanation}</ReactMarkdown>
                                                            </div>
                                                        )}
                                                        <DataVisualization msg={msg} />

                                                        {msg.recommendation && (
                                                            <div className="bg-indigo-50 border-l-4 border-indigo-500 p-4 rounded-r-lg mt-6 shadow-sm">
                                                                <div className="flex gap-3 items-start">
                                                                    <div className="shrink-0 mt-0.5"><span className="text-xl">💡</span></div>
                                                                    <div className="text-[14px] text-indigo-900 font-medium leading-relaxed">
                                                                        <span className="font-bold block mb-1">Business Recommendation</span>
                                                                        {msg.recommendation}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {msg.follow_up_questions && msg.follow_up_questions.length > 0 && (
                                                            <div className="mt-6 pt-4 border-t border-gray-200">
                                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Suggest Follow-up</p>
                                                                <div className="flex flex-wrap gap-2">
                                                                    {msg.follow_up_questions.map((q, qIdx) => (
                                                                        <button
                                                                            key={qIdx}
                                                                            onClick={() => handleSend(q)}
                                                                            disabled={isLoading}
                                                                            className="px-3 py-1.5 bg-white border border-gray-300 hover:border-indigo-400 hover:bg-indigo-50 text-indigo-700 text-xs font-medium rounded-full shadow-sm transition-all"
                                                                        >
                                                                            {q}
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="prose prose-sm prose-indigo max-w-none">
                                                        <ReactMarkdown
                                                            components={{
                                                                a: ({ node, ...props }) => {
                                                                    let url = props.href || '';

                                                                    // Intercept raw tableau links from AI if it forgot formatting rules
                                                                    if (url.includes('analytics.pacificinsurance.com.my') && !url.startsWith('/tableau-dashboards')) {
                                                                        url = `/tableau-dashboards?url=${encodeURIComponent(url)}`;
                                                                    }

                                                                    if (url.startsWith('/tableau-dashboards')) {
                                                                        return (
                                                                            <Link href={url} className="inline-flex items-center gap-1.5 font-semibold text-indigo-600 hover:text-indigo-800 underline decoration-indigo-300 underline-offset-4 transition-all">
                                                                                <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg>
                                                                                {props.children}
                                                                            </Link>
                                                                        );
                                                                    }
                                                                    return (
                                                                        <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:text-blue-800 underline decoration-blue-300 underline-offset-4 transition-all">
                                                                            {props.children}
                                                                            <svg className="w-3.5 h-3.5 shrink-0 mb-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"></path></svg>
                                                                        </a>
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {msg.content}
                                                        </ReactMarkdown>
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <p className="whitespace-pre-wrap text-[15px] leading-relaxed font-sans">{msg.content}</p>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}

                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-white border rounded-2xl rounded-bl-sm px-6 py-4 shadow-sm flex items-center gap-3 text-gray-500 min-w-48">
                                <div className="flex gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                                    <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                                </div>
                                <span className="text-sm font-semibold tracking-wide text-indigo-900">{loadingStage || 'Processing...'}</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} className="h-4" />
                </div>

                {/* Input Area */}
                <div className="bg-white border-t border-gray-200 px-4 sm:px-8 py-5 shrink-0 z-20">
                    <form onSubmit={(e) => { e.preventDefault(); handleSend(input); }} className="max-w-4xl mx-auto relative flex items-center gap-3 bg-[#f8f9fa] rounded-2xl p-2 border border-gray-200 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 hover:border-gray-300 transition-all shadow-sm">
                        <input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Ask about your insurance analytics..."
                            className="flex-1 bg-transparent border-0 focus:ring-0 py-3 px-4 text-gray-800 placeholder:text-gray-400 text-[15px] outline-none font-medium"
                            disabled={isLoading}
                        />
                        <button
                            type="submit"
                            disabled={!input.trim() || isLoading || datasets.length === 0}
                            className="p-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:bg-gray-300 disabled:text-gray-500 disabled:cursor-not-allowed transition-colors shrink-0 shadow-sm"
                        >
                            {isLoading ? (
                                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            ) : (
                                <svg className="w-5 h-5 transform -rotate-90 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5m0 0l7 7m-7-7l-7 7"></path></svg>
                            )}
                        </button>
                    </form>
                    <div className="max-w-4xl mx-auto text-center mt-3">
                        <p className="text-[11px] text-gray-400 font-medium">AI generated answers may be inaccurate. Row-Level Data Access rules are securely injected into your context session automatically.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}