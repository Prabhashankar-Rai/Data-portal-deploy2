'use client';

import { useState, useEffect } from 'react';

type User = {
    user_id: string;
    username: string;
    email: string;
    role?: string;
    created_at: string;
};

type Group = {
    group_id: string;
    group_name: string;
};

export default function UsersManagementPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(true);

    // Form states
    const [isAddingUser, setIsAddingUser] = useState(false);
    const [isEditingUser, setIsEditingUser] = useState(false);
    const [editUserId, setEditUserId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        username: '',
        email: '',
        role: 'USER',
    });

    // Group Assignment State
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [userGroups, setUserGroups] = useState<string[]>([]);
    const [isAssigning, setIsAssigning] = useState(false);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [usersRes, groupsRes] = await Promise.all([
                fetch('/api/users'),
                fetch('/api/groups')
            ]);
            const usersData = await usersRes.json();
            const groupsData = await groupsRes.json();

            if (usersRes.ok) setUsers(usersData.data || []);
            if (groupsRes.ok) setGroups(groupsData.data || []);
        } catch (err: any) {
            console.error(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveUser = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const url = '/api/users';
            const method = isEditingUser ? 'PUT' : 'POST';
            const payload = isEditingUser ? { ...formData, user_id: editUserId } : formData;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            if (!res.ok) throw new Error(`Failed to ${isEditingUser ? 'update' : 'create'} user`);
            setIsAddingUser(false);
            setIsEditingUser(false);
            setEditUserId(null);
            setFormData({ username: '', email: '', role: 'USER' });
            fetchData(); // Refresh list
        } catch (err: any) {
            alert(err.message);
        }
    };

    const handleEditUser = (user: User) => {
        setFormData({ username: user.username, email: user.email, role: user.role || 'USER' });
        setEditUserId(user.user_id);
        setIsEditingUser(true);
        setIsAddingUser(true);
    };

    const handleOpenAssignGroups = async (user: User) => {
        setSelectedUser(user);
        try {
            const res = await fetch(`/api/users/${user.user_id}/groups`);
            const data = await res.json();
            if (res.ok) {
                // Map user mappings which return User ID, Group Name, Group ID.
                setUserGroups(data.data.map((g: any) => g.group_id));
                setIsAssigning(true);
            }
        } catch (err) {
            alert('Error fetching user groups');
        }
    };

    const handleSaveGroups = async () => {
        if (!selectedUser) return;
        try {
            const res = await fetch(`/api/users/${selectedUser.user_id}/groups`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupIds: userGroups }),
            });
            if (!res.ok) throw new Error('Failed to save groups');
            setIsAssigning(false);
        } catch (err: any) {
            alert(err.message);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">User Configuration</h1>
                    <p className="mt-2 text-sm text-gray-500">Create new users and map them to their respective app access Groups.</p>
                </div>
                <button
                    onClick={() => {
                        setFormData({ username: '', email: '', role: 'USER' });
                        setIsEditingUser(false);
                        setEditUserId(null);
                        setIsAddingUser(true);
                    }}
                    className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl shadow-sm hover:bg-blue-500 transition-all"
                >
                    + Add New User
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
            ) : (
                <div className="bg-white shadow-sm ring-1 ring-gray-200 rounded-2xl overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-4 pl-6 pr-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                                <th className="px-3 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                                <th className="px-3 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User ID</th>
                                <th className="px-3 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                                <th className="px-3 py-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 bg-white">
                            {users.map((user) => (
                                <tr key={user.user_id} className="hover:bg-gray-50 transition-colors">
                                    <td className="whitespace-nowrap py-4 pl-6 pr-3">
                                        <div className="flex items-center">
                                            <div className="h-10 w-10 flex-shrink-0 rounded-full bg-gradient-to-tr from-blue-100 to-blue-200 flex items-center justify-center text-blue-700 font-bold uppercase ring-2 ring-white shadow-sm">
                                                {user.username.substring(0, 2)}
                                            </div>
                                            <div className="ml-4">
                                                <div className="font-semibold text-gray-900">{user.username}</div>
                                                <div className="text-sm text-gray-500">{user.email}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${(user.role === 'ADMIN' ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-800')}`}>
                                            {user.role || 'USER'}
                                        </span>
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 font-mono text-xs text-gray-500">
                                        {user.user_id.split('-')[0]}***
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                        {new Date(user.created_at).toLocaleDateString()}
                                    </td>
                                    <td className="whitespace-nowrap px-3 py-4 text-sm font-medium">
                                        <button
                                            onClick={() => handleOpenAssignGroups(user)}
                                            className="text-blue-600 hover:text-blue-900 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors mr-2"
                                        >
                                            Manage User Groups
                                        </button>
                                        <button
                                            onClick={() => handleEditUser(user)}
                                            className="text-gray-600 hover:text-gray-900 bg-gray-50 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors border border-gray-200"
                                        >
                                            Edit
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {users.length === 0 && (
                                <tr>
                                    <td colSpan={4} className="py-8 text-center text-gray-500">No users found.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Add User Modal */}
            {isAddingUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-bold text-gray-900 mb-6">{isEditingUser ? 'Edit User' : 'User Configuration'}</h2>
                        <form onSubmit={handleSaveUser} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
                                <input
                                    required
                                    type="text"
                                    value={formData.username}
                                    onChange={e => setFormData({ ...formData, username: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                    placeholder="admin.doej"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Email ID</label>
                                <input
                                    required
                                    type="email"
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                    placeholder="admin@example.com"
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account Role</label>
                                <select
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none"
                                >
                                    <option value="USER">Standard User (Read Only/Query)</option>
                                    <option value="ADMIN">Data Administrator</option>
                                </select>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsAddingUser(false)}
                                    className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors shadow-md shadow-blue-200"
                                >
                                    {isEditingUser ? 'Save Updates' : 'Create User'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* User Group Mapping Modal */}
            {isAssigning && selectedUser && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in fade-in zoom-in duration-200">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">User Groups</h2>
                        <p className="text-sm text-gray-500 mb-6">Assign {selectedUser.username} to access groups.</p>

                        <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
                            {groups.map(group => (
                                <label key={group.group_id} className="flex items-center p-3 border border-gray-100 rounded-xl hover:bg-gray-50 cursor-pointer transition-colors group">
                                    <input
                                        type="checkbox"
                                        checked={userGroups.includes(group.group_id)}
                                        onChange={(e) => {
                                            if (e.target.checked) setUserGroups([...userGroups, group.group_id]);
                                            else setUserGroups(userGroups.filter(id => id !== group.group_id));
                                        }}
                                        className="h-5 w-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 transition-all"
                                    />
                                    <span className="ml-3 font-medium text-gray-900 group-hover:text-blue-700 transition-colors">{group.group_name}</span>
                                </label>
                            ))}
                            {groups.length === 0 && (
                                <div className="text-sm text-gray-500 text-center py-4">No groups created yet. Setup Groups first.</div>
                            )}
                        </div>

                        <div className="mt-8 flex justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => setIsAssigning(false)}
                                className="px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-xl transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSaveGroups}
                                className="px-5 py-2.5 text-sm font-semibold text-white bg-blue-600 rounded-xl hover:bg-blue-500 transition-colors shadow-md shadow-blue-200"
                            >
                                Assign Groups
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
