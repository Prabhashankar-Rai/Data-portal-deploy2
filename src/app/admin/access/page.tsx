'use client';

import { useState, useEffect } from 'react';

type Module = { module_id: string; module_name: string };
type User = { user_id: string; username: string };
type Group = { group_id: string; group_name: string };
type AccessLog = { access_id: string; user_id?: string; group_id?: string; module_id: string };

export default function UserModuleAccessPage() {
    const [modules, setModules] = useState<Module[]>([]);
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [access, setAccess] = useState<AccessLog[]>([]);

    const [selectedEntity, setSelectedEntity] = useState<{ id: string, type: 'user' | 'group' } | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        const [mRes, uRes, gRes, aRes] = await Promise.all([
            fetch('/api/modules'), fetch('/api/users'), fetch('/api/groups'), fetch('/api/module-access')
        ]);
        const mData = await mRes.json();
        const uData = await uRes.json();
        const gData = await gRes.json();
        const aData = await aRes.json();

        setModules(mData.data || []);
        setUsers(uData.data || []);
        setGroups(gData.data || []);
        setAccess(aData.data || []);
    };

    const isModuleAssigned = (moduleId: string) => {
        if (!selectedEntity) return false;
        return access.some(a =>
            a.module_id === moduleId &&
            (selectedEntity.type === 'user' ? a.user_id === selectedEntity.id : a.group_id === selectedEntity.id)
        );
    };

    const toggleAccess = async (moduleId: string) => {
        if (!selectedEntity) return;

        // Optimistic toggle
        const currentlyAssigned = isModuleAssigned(moduleId);
        const bodyPayload = {
            type: selectedEntity.type,
            entity_id: selectedEntity.id,
            module_id: moduleId,
            assigned: !currentlyAssigned
        };

        try {
            await fetch('/api/module-access', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(bodyPayload)
            });
            fetchData(); // reload truth
        } catch {
            alert('Failed to update mapping.');
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">User Module Access</h1>
                <p className="mt-2 text-sm text-gray-500">Determine which exact Application Modules are visible per User ID or Group ID.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                {/* Left Column: Entity Picker */}
                <div className="lg:col-span-1 bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl overflow-hidden flex flex-col h-[600px]">
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

                {/* Right Column: Module Toggles */}
                <div className="lg:col-span-2 bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl p-6">
                    {!selectedEntity ? (
                        <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                            Select a Group or User from the sidebar to configure visibility.
                        </div>
                    ) : (
                        <div className="animate-in fade-in">
                            <div className="mb-6 pb-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold text-gray-900">
                                    {selectedEntity.type === 'group' ? 'Group Access' : 'User Access'}
                                </h2>
                                <p className="text-sm text-gray-500 font-mono mt-1">Target ID: {selectedEntity.id}</p>
                            </div>

                            <div className="space-y-3">
                                {modules.map(mod => {
                                    const isAssigned = isModuleAssigned(mod.module_id);
                                    return (
                                        <div key={mod.module_id} className="flex items-center justify-between p-4 rounded-xl border border-gray-100 hover:border-gray-200 bg-gray-50/50 transition-colors">
                                            <div>
                                                <div className="font-semibold text-gray-900">{mod.module_name}</div>
                                                <div className="text-xs text-gray-400 font-mono mt-0.5">ID: {mod.module_id.split('-')[0]}</div>
                                            </div>

                                            <button
                                                onClick={() => toggleAccess(mod.module_id)}
                                                className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isAssigned ? 'bg-green-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isAssigned ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

            </div>
        </div>
    );
}
