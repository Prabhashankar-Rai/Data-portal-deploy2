'use client';

import { useState, useEffect } from 'react';

type Group = {
    group_id: string;
    group_name: string;
    description: string;
    created_at: string;
};

export default function GroupsManagementPage() {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    // Form state
    const [isAddingGroup, setIsAddingGroup] = useState(false);
    const [isEditingGroup, setIsEditingGroup] = useState(false);
    const [editGroupId, setEditGroupId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        group_name: '',
        description: '',
    });

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/groups');
            const data = await res.json();
            if (res.ok) setGroups(data.data || []);
        } catch (err: any) {
            console.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = '/api/groups';
            const method = isEditingGroup ? 'PUT' : 'POST';
            const payload = isEditingGroup ? { ...formData, group_id: editGroupId } : formData;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`Failed to ${isEditingGroup ? 'update' : 'create'} Group Configuration`);
            setIsAddingGroup(false);
            setIsEditingGroup(false);
            setEditGroupId(null);
            setFormData({ group_name: '', description: '' });
            fetchGroups();
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleEditGroup = (group: Group) => {
        setFormData({ group_name: group.group_name, description: group.description || '' });
        setEditGroupId(group.group_id);
        setIsEditingGroup(true);
        setIsAddingGroup(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Group Configuration</h1>
                    <p className="mt-2 text-sm text-gray-500">Provide user access as a Group. Define groups that will have tied module and dataset permissions.</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ group_name: '', description: '' });
                        setIsEditingGroup(false);
                        setEditGroupId(null);
                        setIsAddingGroup(true);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 transition-all"
                >
                    + Create Group
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {groups.map((group) => (
                        <div key={group.group_id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow group relative">

                            <div className="flex justify-between items-start mb-4">
                                <div className="h-12 w-12 bg-indigo-100 text-indigo-700 rounded-xl flex items-center justify-center font-bold text-xl uppercase ring-4 ring-white shadow-sm">
                                    {group.group_name.substring(0, 2)}
                                </div>
                                <button
                                    onClick={() => handleEditGroup(group)}
                                    className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors border border-transparent hover:border-indigo-100"
                                >
                                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                            </div>
                            <h3 className="text-xl font-bold text-gray-900 mb-2 truncate pr-10">{group.group_name}</h3>
                            <p className="text-sm font-mono text-gray-400 mb-2 truncate">ID: {group.group_id.split('-')[0]}***</p>
                            <p className="text-sm text-gray-500 mb-6 line-clamp-3 h-14">
                                {group.description || "No specific group description provided."}
                            </p>
                        </div>
                    ))}

                    {groups.length === 0 && (
                        <div className="col-span-full py-16 text-center border-2 border-dashed border-gray-200 rounded-3xl">
                            <p className="text-gray-500 font-medium">No Groups Configured.</p>
                            <p className="text-sm text-gray-400 mt-1">Configure groups like "Administrators" or "Analysts" to group user access.</p>
                        </div>
                    )}
                </div>
            )}

            {/* Add Group Modal */}
            {isAddingGroup && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">{isEditingGroup ? 'Edit Group' : 'Create New Group'}</h2>
                        <form onSubmit={handleSaveGroup} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Group Name</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.group_name}
                                    onChange={e => setFormData({ ...formData, group_name: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none"
                                    placeholder="e.g. Sales Regional"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Group Description</label>
                                <textarea
                                    value={formData.description}
                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all outline-none resize-none h-24"
                                    placeholder="Explain the purpose of this group..."
                                />
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingGroup(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-indigo-600 rounded-xl hover:bg-indigo-500 transition-colors shadow-md shadow-indigo-200"
                                >
                                    {isEditingGroup ? 'Save Updates' : 'Create Group'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
