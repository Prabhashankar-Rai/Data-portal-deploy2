'use client';

import { useEffect, useState } from 'react';

type FilterType = 'none' | 'date' | 'multi' | 'text' | 'number';

type ColumnConfig = {
  name: string;
  visible: boolean;
  filter: FilterType;
  description?: string;
  aiRestricted?: boolean;
};

type DatasetConfig = {
  id: string;
  displayLabel: string;
  fileName: string;
  filePath: string;
  purpose: string;
  columns: ColumnConfig[];
  createdBy: string;
  updatedAt: string;
};

const emptyForm: Omit<DatasetConfig, 'id' | 'createdBy' | 'updatedAt'> = {
  displayLabel: '',
  fileName: '',
  filePath: '',
  purpose: '',
  columns: [],
};

export default function DatasetAdminPage() {
  const [datasets, setDatasets] = useState<DatasetConfig[]>([]);
  const [editing, setEditing] = useState<DatasetConfig | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loadingColumns, setLoadingColumns] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/datasets');
      if (!res.ok) return;
      const data = (await res.json()) as DatasetConfig[];
      setDatasets(data);
    };
    load();
  }, []);

  const startNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setError(null);
  };

  const startEdit = (ds: DatasetConfig) => {
    setEditing(ds);
    setForm({
      displayLabel: ds.displayLabel,
      fileName: ds.fileName,
      filePath: ds.filePath,
      purpose: ds.purpose,
      columns: ds.columns || [],
    });
    setError(null);
  };

  const handleLoadColumns = async () => {
    if (!form.filePath) {
      setError('Please provide a file path before loading columns.');
      return;
    }
    setError(null);
    setLoadingColumns(true);
    try {
      const res = await fetch('/api/datasets/preview-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: form.filePath }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Unable to load columns.');
        return;
      }
      const columns: ColumnConfig[] = (data.columns as string[]).map(name => ({
        name,
        visible: true,
        filter: 'none',
        aiRestricted: false,
      }));
      setForm(prev => ({ ...prev, columns }));
    } catch (e: any) {
      setError(e?.message || 'Unexpected error while loading columns.');
    } finally {
      setLoadingColumns(false);
    }
  };

  const handleSave = async () => {
    if (!form.displayLabel || !form.fileName || !form.filePath) {
      setError('Display label, file name and file path are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/datasets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(editing ? { id: editing.id } : {}),
          ...form,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || 'Unable to save dataset.');
        return;
      }
      const updated = editing
        ? datasets.map(d => (d.id === data.id ? data : d))
        : [...datasets, data];
      setDatasets(updated);
      setEditing(data);
    } catch (e: any) {
      setError(e?.message || 'Unexpected error while saving dataset.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Are you sure you want to completely delete the "${name}" dataset?`)) {
      return;
    }
    
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/datasets/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data?.error || 'Unable to delete dataset.');
        return;
      }
      setDatasets(prev => prev.filter(d => d.id !== id));
      if (editing?.id === id) {
        startNew();
      }
    } catch (e: any) {
      setError(e?.message || 'Unexpected error while deleting dataset.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dataset Registry</h1>
        <p className="mt-1 text-sm text-gray-600">
          Register and manage datasets that appear in the Data Download section.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr),minmax(0,3fr)]">
        {/* Left: existing datasets */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-gray-900">Registered Datasets</h2>
            <button
              type="button"
              onClick={startNew}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700"
            >
              + New Dataset
            </button>
          </div>
          {datasets.length === 0 ? (
            <p className="text-sm text-gray-500">
              No datasets registered yet. Click &ldquo;New Dataset&rdquo; to create one.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 text-sm">
              {datasets.map(ds => (
                <li key={ds.id} className="flex items-start justify-between gap-3 py-3">
                  <div>
                    <div className="font-semibold text-gray-900">{ds.displayLabel}</div>
                    <div className="text-xs text-gray-500">
                      File: {ds.fileName} &middot; Last updated:{' '}
                      {new Date(ds.updatedAt).toLocaleString()}
                    </div>
                    {ds.purpose && (
                      <div className="mt-1 text-xs text-gray-600 line-clamp-2">
                        {ds.purpose}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(ds)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ds.id, ds.displayLabel)}
                      disabled={deletingId === ds.id}
                      className="rounded-md border border-red-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deletingId === ds.id ? 'Deleting...' : 'Delete'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Right: editor */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-900">
            {editing ? `Edit: ${editing.displayLabel}` : 'New Dataset'}
          </h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Display Label
              </label>
              <input
                type="text"
                value={form.displayLabel}
                onChange={e => setForm(f => ({ ...f, displayLabel: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="e.g. Policy Data"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  File Name
                </label>
                <input
                  type="text"
                  value={form.fileName}
                  onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. policy.csv"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  File Path (local)
                </label>
                <input
                  type="text"
                  value={form.filePath}
                  onChange={e => setForm(f => ({ ...f, filePath: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. C:\Data\policy.csv"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700">
                Purpose / Description
              </label>
              <textarea
                value={form.purpose}
                onChange={e => setForm(f => ({ ...f, purpose: e.target.value }))}
                rows={2}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                placeholder="Describe what this dataset is and when it should be downloaded."
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-semibold text-gray-700">Columns</div>
                <p className="text-xs text-gray-500">
                  Load column names from the CSV, then choose visibility and filters.
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadColumns}
                disabled={loadingColumns || !form.filePath}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loadingColumns ? 'Loading…' : 'Load Columns'}
              </button>
            </div>

            {form.columns.length > 0 && (
              <div className="max-h-72 overflow-auto rounded-lg border border-gray-200">
                <table className="min-w-full text-left text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 font-semibold text-gray-700">Column</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Description</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Visible</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">AI Restricted</th>
                      <th className="px-3 py-2 font-semibold text-gray-700">Filter</th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.columns.map((col, idx) => (
                      <tr
                        key={`${col.name}-${idx}`}
                        className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                      >
                        <td className="px-3 py-2 text-gray-900">{col.name}</td>
                        <td className="px-3 py-2">
                          <input
                            type="text"
                            value={col.description || ''}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                columns: f.columns.map((c, i) =>
                                  i === idx
                                    ? { ...c, description: e.target.value }
                                    : c,
                                ),
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
                            placeholder="Optional desc e.g. Number of Risks"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={col.visible}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                columns: f.columns.map((c, i) =>
                                  i === idx
                                    ? { ...c, visible: e.target.checked }
                                    : c,
                                ),
                              }))
                            }
                            className="h-4 w-4 accent-blue-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={col.aiRestricted || false}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                columns: f.columns.map((c, i) =>
                                  i === idx
                                    ? { ...c, aiRestricted: e.target.checked }
                                    : c,
                                ),
                              }))
                            }
                            className="h-4 w-4 accent-red-600"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <select
                            value={col.filter}
                            onChange={e =>
                              setForm(f => ({
                                ...f,
                                columns: f.columns.map((c, i) =>
                                  i === idx
                                    ? { ...c, filter: e.target.value as FilterType }
                                    : c,
                                ),
                              }))
                            }
                            className="w-full rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-100"
                          >
                            <option value="none">No filter</option>
                            <option value="date">Date (equal / between)</option>
                            <option value="multi">Multi-select dropdown</option>
                            <option value="text">Text search</option>
                            <option value="number">Numeric</option>
                          </select>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {error && (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={startNew}
                className="rounded-md border border-gray-300 px-4 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-md bg-blue-600 px-4 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
              >
                {saving ? 'Saving…' : 'Save Dataset'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

