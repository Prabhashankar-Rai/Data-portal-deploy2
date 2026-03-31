'use client';

import { useState, useEffect } from 'react';

type User = { user_id: string; username: string };
type Group = { group_id: string; group_name: string };
type Dataset = { id: string; displayLabel: string; fileName: string };
type Action = { action_id: string; action_name: string };

type AppAction = {
    app_action_id: string;
    user_id?: string;
    group_id?: string;
    dataset_id: string;
    action_id: string;
};

export default function UserAppActionsPage() {
    const [loading, setLoading] = useState(true);

    // Reference data
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [datasets, setDatasets] = useState<Dataset[]>([]);
    const [actions, setActions] = useState<Action[]>([]);

    // Mapping data
    const [appActions, setAppActions] = useState<AppAction[]>([]);

    // Selection state
    const [selectedEntity, setSelectedEntity] = useState<{ id: string, type: 'user' | 'group' } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [uRes, gRes, dRes, mapRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/groups'),
                fetch('/api/datasets'),
                fetch('/api/app-actions')
            ]);

            const [uData, gData, dData, mapData] = await Promise.all([
                uRes.json(), gRes.json(), dRes.json(), mapRes.json()
            ]);

            setUsers(uData.data || []);
            setGroups(gData.data || []);
            setDatasets(dData || []); // Datasets array directly

            setActions(mapData.actions || []);
            setAppActions(mapData.appActions || []);
        } finally {
            setLoading(false);
        }
    };

    const isActionAssigned = (datasetId: string, actionId: string) => {
        if (!selectedEntity) return false;
        return appActions.some(a =>
            a.dataset_id === datasetId && a.action_id === actionId &&
            (selectedEntity.type === 'user' ? a.user_id === selectedEntity.id : a.group_id === selectedEntity.id)
        );
    };

    const toggleAction = async (datasetId: string, actionId: string) => {
        if (!selectedEntity) return;

        const currentlyAssigned = isActionAssigned(datasetId, actionId);

        await fetch('/api/app-actions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                entity_type: selectedEntity.type,
                entity_id: selectedEntity.id,
                dataset_id: datasetId,
                action_id: actionId,
                assigned: !currentlyAssigned
            })
        });
        fetchData();
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">User App Actions</h1>
                <p className="mt-2 text-sm text-gray-500">Determine specifically if a User or Group is allowed to View, Download, or Create for registered datasets.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Entity Selector */}
                <div className="lg:col-span-1 bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl overflow-hidden flex flex-col h-[700px]">
                    <div className="border-b border-gray-100 bg-gray-50 p-4 font-semibold text-gray-700">Select Target</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        <div>
                            <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-3 pl-2">Groups</h3>
                            <div className="space-y-1">
                                {groups.map(g => (
                                    <button
                                        key={g.group_id}
                                        onClick={() => setSelectedEntity({ id: g.group_id, type: 'group' })}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedEntity?.id === g.group_id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        👥 {g.group_name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <h3 className="text-xs uppercase tracking-wider text-gray-400 font-bold mb-3 pl-2">Users</h3>
                            <div className="space-y-1">
                                {users.map(u => (
                                    <button
                                        key={u.user_id}
                                        onClick={() => setSelectedEntity({ id: u.user_id, type: 'user' })}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedEntity?.id === u.user_id ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        👤 {u.username}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration Pane */}
                <div className="lg:col-span-3 space-y-6">
                    {!selectedEntity ? (
                        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl p-6 h-full flex flex-col items-center justify-center text-gray-400">
                            <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"></path></svg>
                            Select a Group or User from the sidebar to configure dataset app actions.
                        </div>
                    ) : (
                        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
                            <div className="mb-6">
                                <h2 className="text-xl font-bold text-gray-900">Registered Dataset Actions</h2>
                                <p className="text-sm text-gray-500 mt-1">Check actions to permit them (e.g. allowing users to Download).</p>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm whitespace-nowrap">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold text-gray-700">Dataset</th>
                                            {actions.map(a => (
                                                <th key={a.action_id} className="px-4 py-3 font-semibold text-center text-gray-700">
                                                    {a.action_name}
                                                </th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {datasets.map(ds => (
                                            <tr key={ds.id} className="hover:bg-gray-50/50">
                                                <td className="px-4 py-4">
                                                    <div className="font-semibold text-gray-900">{ds.displayLabel}</div>
                                                    <div className="text-xs text-gray-400 mt-0.5">{ds.fileName}</div>
                                                </td>
                                                {actions.map(action => {
                                                    const assigned = isActionAssigned(ds.id, action.action_id);
                                                    return (
                                                        <td key={action.action_id} className="px-4 py-4 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={assigned}
                                                                onChange={() => toggleAction(ds.id, action.action_id)}
                                                                className="h-5 w-5 accent-blue-600 rounded cursor-pointer"
                                                            />
                                                        </td>
                                                    );
                                                })}
                                            </tr>
                                        ))}
                                        {datasets.length === 0 && (
                                            <tr><td colSpan={actions.length + 1} className="py-8 text-center text-gray-400">No datasets registered.</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
