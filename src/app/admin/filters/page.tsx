'use client';

import { useState, useEffect } from 'react';

type Group = { group_id: string; group_name: string };
type AccessElement = {
    element_id: number;
    element_name: string;
    element_datatype: string;
    generic_column_name: string;
};

type UserAccessFilter = {
    filter_id: string;
    group_id: string;
    element_id: number;
    operator: string;
    element_value: string;
};

const OPERATORS = ['=', '>=', '<=', '<>', 'IN', 'LIKE', 'NOT IN'];

export default function UserAccessFiltersPage() {
    const [loading, setLoading] = useState(true);

    // Reference data
    const [groups, setGroups] = useState<Group[]>([]);
    const [elements, setElements] = useState<AccessElement[]>([]);

    // Mapping data
    const [filters, setFilters] = useState<UserAccessFilter[]>([]);

    // Selection state
    const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);

    // Form state
    const [newFilter, setNewFilter] = useState({
        element_id: 1,
        operator: '=',
        element_value: ''
    });

    const [newElementForm, setNewElementForm] = useState({
        element_name: '',
        element_datatype: 'Character',
        generic_column_name: ''
    });

    const [editingElementId, setEditingElementId] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [gRes, eRes, fRes] = await Promise.all([
                fetch('/api/groups'),
                fetch('/api/access-elements'),
                fetch('/api/user-access-filters')
            ]);

            const [gData, eData, fData] = await Promise.all([
                gRes.json(), eRes.json(), fRes.json()
            ]);

            setGroups(gData.data || []);
            setElements(eData.data || []);
            setFilters(fData.data || []);

            if (eData.data && eData.data.length > 0) {
                setNewFilter(prev => ({ ...prev, element_id: eData.data[0].element_id }));
            }
        } finally {
            setLoading(false);
        }
    };

    const handleCreateFilter = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedGroup) return;

        await fetch('/api/user-access-filters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'filter',
                group_id: selectedGroup.group_id,
                ...newFilter,
                element_id: Number(newFilter.element_id)
            })
        });
        setNewFilter(prev => ({ ...prev, element_value: '' }));
        fetchData();
    };

    const handleCreateOrUpdateElement = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (editingElementId !== null) {
            await fetch('/api/access-elements', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ element_id: editingElementId, ...newElementForm })
            });
            setEditingElementId(null);
        } else {
            await fetch('/api/access-elements', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newElementForm)
            });
        }
        
        setNewElementForm({ element_name: '', element_datatype: 'Character', generic_column_name: '' });
        fetchData();
    };

    const handleEditElementClick = (el: AccessElement) => {
        setEditingElementId(el.element_id);
        setNewElementForm({
            element_name: el.element_name,
            element_datatype: el.element_datatype,
            generic_column_name: el.generic_column_name
        });
    };

    const handleDeleteElementClick = async (element_id: number) => {
        if (!confirm('Are you sure you want to delete this access element? It may be associated with existing filters.')) return;
        await fetch('/api/access-elements', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ element_id })
        });
        fetchData();
    };

    const handleDeleteFilter = async (filterId: string) => {
        await fetch('/api/user-access-filters', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                type: 'delete_filter',
                filter_id: filterId
            })
        });
        fetchData();
    };

    // Filter parameters by selected group
    const visibleFilters = selectedGroup
        ? filters.filter(f => f.group_id === selectedGroup.group_id)
        : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">User Access Filters</h1>
                <p className="mt-2 text-sm text-gray-500">Configure global Row-Level filter policies assigning Access Elements to Groups.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">

                {/* Entity Selector */}
                <div className="lg:col-span-1 bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl overflow-hidden flex flex-col h-[700px]">
                    <div className="border-b border-gray-100 bg-gray-50 p-4 font-semibold text-gray-700">Select Target Group</div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-6">
                        <div>
                            <div className="space-y-1">
                                {groups.map(g => (
                                    <button
                                        key={g.group_id}
                                        onClick={() => setSelectedGroup(g)}
                                        className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${selectedGroup?.group_id === g.group_id ? 'bg-indigo-50 text-indigo-700 font-medium' : 'text-gray-700 hover:bg-gray-50'}`}
                                    >
                                        👥 {g.group_name}
                                    </button>
                                ))}
                                {groups.length === 0 && (
                                    <p className="text-sm text-gray-400 p-2">Wait, you have no Groups created!</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Configuration Pane */}
                <div className="lg:col-span-3 space-y-6">
                    {!selectedGroup ? (
                        <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl p-6 h-full flex flex-col items-center justify-center text-gray-400">
                            <svg className="w-16 h-16 text-gray-200 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"></path></svg>
                            Select a Group from the sidebar to establish dataset row-level constraints.
                        </div>
                    ) : (
                        <>
                            {/* Filters Viewer */}
                            <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl p-6 animate-in fade-in slide-in-from-bottom-4">
                                <div className="mb-6 flex items-center justify-between">
                                    <div>
                                        <h2 className="text-xl font-bold text-gray-900">Assigned Access Filters</h2>
                                        <p className="text-sm text-gray-500 mt-1">Users in <span className="font-semibold text-gray-800">{selectedGroup.group_name}</span> can access datasets matching these criteria.</p>
                                    </div>
                                </div>

                                {visibleFilters.length > 0 ? (
                                    <div className="w-full flex flex-col gap-3">
                                        {visibleFilters.map(f => {
                                            const el = elements.find(e => e.element_id === f.element_id);
                                            if (!el) return null;
                                            return (
                                                <div key={f.filter_id} className="flex items-center justify-between p-4 bg-gray-50 border border-gray-100 rounded-xl hover:border-gray-200 transition">
                                                    <div className="flex items-center space-x-4">
                                                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 text-blue-600 font-bold rounded-lg flex items-center justify-center uppercase shadow-sm">
                                                            {el.generic_column_name.substring(0, 2)}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-gray-900 mb-0.5">{el.element_name}</div>
                                                            <div className="text-sm text-gray-600 font-mono bg-white px-2 py-0.5 rounded shadow-sm border border-gray-100 mt-1 inline-block">
                                                                <span className="text-indigo-600">{el.generic_column_name}</span> <span className="text-pink-600 font-bold mx-1">{f.operator}</span> <span className="text-emerald-700">'{f.element_value}'</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteFilter(f.filter_id)}
                                                        className="text-gray-400 hover:text-red-500 bg-white p-2 border border-gray-200 shadow-sm rounded-lg transition-colors"
                                                        title="Remove constraint"
                                                    >
                                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                    </button>
                                                </div>
                                            )
                                        })}
                                    </div>
                                ) : (
                                    <div className="p-8 border-2 border-dashed border-gray-200 rounded-xl text-center text-sm text-gray-500 mb-8">
                                        No filters applied to this group. Users will see no targeted row-level access explicitly mapped.
                                    </div>
                                )}

                                <hr className="my-8 border-gray-100" />

                                <form onSubmit={handleCreateFilter} className="bg-gray-50/50 rounded-xl p-6 border border-gray-200">
                                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        <svg className="w-5 h-5 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                        Add Target Filter for {selectedGroup.group_name}
                                    </h3>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="lg:col-span-2">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Access Element</label>
                                            <select
                                                required
                                                value={newFilter.element_id}
                                                onChange={e => setNewFilter({ ...newFilter, element_id: parseInt(e.target.value) })}
                                                className="w-full text-sm px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition"
                                            >
                                                {elements.map(el => (
                                                    <option key={el.element_id} value={el.element_id}>
                                                        {el.element_name} / {el.generic_column_name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="lg:col-span-1">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Operator</label>
                                            <select
                                                required
                                                value={newFilter.operator}
                                                onChange={e => setNewFilter({ ...newFilter, operator: e.target.value })}
                                                className="w-full text-sm px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition"
                                            >
                                                {OPERATORS.map(op => (
                                                    <option key={op} value={op}>{op}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div className="lg:col-span-1">
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Element Value</label>
                                            <input
                                                required
                                                type="text"
                                                placeholder="e.g. MOT"
                                                value={newFilter.element_value}
                                                onChange={e => setNewFilter({ ...newFilter, element_value: e.target.value })}
                                                className="w-full text-sm px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition"
                                            />
                                        </div>
                                    </div>
                                    <div className="mt-5 flex justify-end">
                                        <button type="submit" className="px-5 py-2.5 bg-gray-900 text-white text-sm font-semibold rounded-lg hover:bg-gray-800 shadow-md transition-all active:scale-95 flex items-center gap-2">
                                            Enforce Filter
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Global Elements List */}
                            <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl p-6 mt-6 animate-in fade-in slide-in-from-bottom-6">
                                <div className="mb-4">
                                    <h2 className="text-xl font-bold text-gray-900">Global Access Elements</h2>
                                    <p className="text-sm text-gray-500 mt-1">Configure new access elements for row-level filtering.</p>
                                </div>
                                
                                <form onSubmit={handleCreateOrUpdateElement} className={`mb-6 rounded-xl p-6 border transition-all duration-300 ${editingElementId !== null ? 'bg-blue-50/30 border-blue-200' : 'bg-gray-50/50 border-gray-200'} shadow-sm`}>
                                    <h3 className="text-base font-bold text-gray-800 mb-4 flex items-center gap-2">
                                        {editingElementId !== null ? (
                                            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"></path></svg>
                                        ) : (
                                            <svg className="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path></svg>
                                        )}
                                        {editingElementId !== null ? 'Edit Access Element' : 'Register New Access Element'}
                                    </h3>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 font-sans">
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Element Name</label>
                                            <input required type="text" placeholder="e.g. Region" value={newElementForm.element_name} onChange={e => setNewElementForm({ ...newElementForm, element_name: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition" />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Data Type</label>
                                            <select required value={newElementForm.element_datatype} onChange={e => setNewElementForm({ ...newElementForm, element_datatype: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition">
                                                <option value="Character">Character</option>
                                                <option value="Numeric">Numeric</option>
                                                <option value="Date">Date</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">Generic Column</label>
                                            <input required type="text" placeholder="e.g. REGION_CODE" value={newElementForm.generic_column_name} onChange={e => setNewElementForm({ ...newElementForm, generic_column_name: e.target.value })} className="w-full text-sm px-3 py-2.5 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none shadow-sm transition" />
                                        </div>
                                    </div>
                                    
                                    <div className="mt-5 flex justify-end gap-3 border-t border-gray-200/50 pt-5">
                                        {editingElementId !== null && (
                                            <button type="button" onClick={() => { setEditingElementId(null); setNewElementForm({ element_name: '', element_datatype: 'Character', generic_column_name: '' }); }} className="px-5 py-2.5 bg-white border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 shadow-sm transition-all active:scale-95">
                                                Cancel
                                            </button>
                                        )}
                                        <button type="submit" className={`px-5 py-2.5 text-white text-sm font-semibold rounded-lg shadow-md transition-all active:scale-95 flex items-center gap-2 ${editingElementId !== null ? 'bg-blue-600 hover:bg-blue-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                                            {editingElementId !== null ? 'Update Element' : 'Add Element'}
                                        </button>
                                    </div>
                                </form>

                                <div className="overflow-x-auto rounded-xl border border-gray-200">
                                    <table className="w-full text-left text-sm whitespace-nowrap">
                                        <thead className="bg-gray-50 border-b border-gray-200">
                                            <tr>
                                                <th className="px-4 py-3 font-semibold text-gray-700">Element ID</th>
                                                <th className="px-4 py-3 font-semibold text-gray-700">Element Name</th>
                                                <th className="px-4 py-3 font-semibold text-gray-700">DataType</th>
                                                <th className="px-4 py-3 font-semibold text-gray-700">Generic Column</th>
                                                <th className="px-4 py-3 font-semibold text-gray-700 flex-shrink-0 w-[100px] text-right">Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {elements.map(el => (
                                                <tr key={el.element_id} className={`hover:bg-gray-50/50 ${editingElementId === el.element_id ? 'bg-blue-50/50' : ''}`}>
                                                    <td className="px-4 py-3 text-gray-600">{el.element_id}</td>
                                                    <td className="px-4 py-3 font-medium text-gray-900">{el.element_name}</td>
                                                    <td className="px-4 py-3 text-gray-600">{el.element_datatype}</td>
                                                    <td className="px-4 py-3 text-indigo-600 font-mono">{el.generic_column_name}</td>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            <button 
                                                                onClick={() => handleEditElementClick(el)}
                                                                className="text-blue-600 hover:text-blue-800 p-1 rounded-md hover:bg-blue-50 transition-colors"
                                                                title="Edit Element"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                                            </button>
                                                            <button 
                                                                onClick={() => handleDeleteElementClick(el.element_id)}
                                                                className="text-red-500 hover:text-red-700 p-1 rounded-md hover:bg-red-50 transition-colors"
                                                                title="Delete Element"
                                                            >
                                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
