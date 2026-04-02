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
  sourceType: 'FILE' | 'WAREHOUSE';
  fileName: string;
  filePath: string;
  warehouseTable?: string;
  purpose: string;
  columns: ColumnConfig[];
  createdBy: string;
  updatedAt: string;
};

const emptyForm: Omit<DatasetConfig, 'id' | 'createdBy' | 'updatedAt'> & { csvContent?: string, file?: File | null } = {
  displayLabel: '',
  sourceType: 'FILE',
  fileName: '',
  filePath: '',
  warehouseTable: '',
  purpose: '',
  columns: [],
  csvContent: '',
  file: null,
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
      sourceType: ds.sourceType || 'FILE',
      fileName: ds.fileName,
      filePath: ds.filePath,
      warehouseTable: ds.warehouseTable || '',
      purpose: ds.purpose,
      columns: ds.columns || [],
      csvContent: '', // Don't load full content in edit mode unless re-uploading
    });
    setError(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Read only the first 10KB for the preview/visual check
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const firstLine = content.split(/\r?\n/)[0];
      setForm(prev => ({
        ...prev,
        fileName: file.name,
        csvContent: content.slice(0, 10000), // Only keep a small sample in state
        file: file, // Store the actual file for saving
        filePath: `[Upload: ${file.name}]`, 
      }));
    };
    // Use slice to read only the beginning of the file for preview
    reader.readAsText(file.slice(0, 10000));
  };

  const handleLoadColumns = async () => {
    if (form.sourceType === 'FILE' && !form.filePath && !form.csvContent) {
      setError('Please provide a file path or upload a file before loading columns.');
      return;
    }
    if (form.sourceType === 'WAREHOUSE' && !form.warehouseTable) {
      setError('Please provide a table name from your warehouse.');
      return;
    }
    setError(null);
    setLoadingColumns(true);
    try {
      // For preview, we only send the first line to the server
      const firstLine = form.csvContent?.split(/\r?\n/)[0] || '';
      
      const res = await fetch('/api/datasets/preview-columns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          sourceType: form.sourceType,
          filePath: form.filePath,
          warehouseTable: form.warehouseTable,
          csvContent: firstLine // Only send the header line
        }),
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
    if (!form.displayLabel || (form.sourceType === 'FILE' && !form.fileName)) {
      setError('Display label and file name are required.');
      return;
    }
    if (form.sourceType === 'WAREHOUSE' && !form.warehouseTable) {
      setError('Warehouse table name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const formData = new FormData();
      if (editing) formData.append('id', editing.id);
      formData.append('displayLabel', form.displayLabel);
      formData.append('sourceType', form.sourceType);
      formData.append('fileName', form.fileName || (form.sourceType === 'WAREHOUSE' ? form.warehouseTable || '' : ''));
      formData.append('filePath', form.filePath);
      formData.append('warehouseTable', form.warehouseTable || '');
      formData.append('purpose', form.purpose);
      formData.append('columns', JSON.stringify(form.columns));
      
      // If we have a File object, send it as binary
      if (form.file) {
        formData.append('file', form.file);
      } else if (form.csvContent) {
        // Fallback for edge cases
        formData.append('csvContent', form.csvContent);
      }

      const res = await fetch('/api/datasets', {
        method: 'POST',
        body: formData, // Sending as FormData
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
      // Clear content after save to prevent massive state bloat
      setForm(prev => ({ ...prev, csvContent: '' }));
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
          Register and manage datasets. You can upload CSV files or connect directly to your **Postgres Warehouse** tables.
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
                      Source: {ds.sourceType === 'WAREHOUSE' ? `Warehouse (${ds.warehouseTable})` : `File (${ds.fileName})`} &middot; Updated:{' '}
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
                id="displayLabelInput"
                name="displayLabel"
                type="text"
                value={form.displayLabel}
                onChange={e => setForm(f => ({ ...f, displayLabel: e.target.value }))}
                className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 placeholder-gray-400 opacity-100"
                placeholder="e.g. Policy Data"
                required
                disabled={false}
              />
            </div>

            <div className="flex gap-4 p-3 rounded-lg bg-blue-50 border border-blue-100">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="sourceType"
                  value="FILE"
                  checked={form.sourceType === 'FILE'}
                  onChange={() => setForm(f => ({ ...f, sourceType: 'FILE', fileName: f.file?.name || '' }))}
                  className="accent-blue-600"
                />
                File Upload / Path
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="sourceType"
                  value="WAREHOUSE"
                  checked={form.sourceType === 'WAREHOUSE'}
                  onChange={() => setForm(f => ({ ...f, sourceType: 'WAREHOUSE' }))}
                  className="accent-blue-600"
                />
                Warehouse Table (Direct)
              </label>
            </div>

            {form.sourceType === 'FILE' ? (
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Upload CSV File (Direct to Cloud)
                  </label>
                  <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="mt-1 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-1.5 text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-700">
                    Manual File Path (Legacy / Local)
                  </label>
                  <input
                    type="text"
                    value={form.filePath}
                    onChange={e => setForm(f => ({ ...f, filePath: e.target.value }))}
                    disabled={!!form.csvContent}
                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                    placeholder="e.g. C:\Data\policy.csv"
                  />
                </div>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-gray-700">
                  Data Warehouse Table Name
                </label>
                <input
                  type="text"
                  value={form.warehouseTable}
                  onChange={e => setForm(f => ({ ...f, warehouseTable: e.target.value }))}
                  className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  placeholder="e.g. public.sales_leads"
                />
                <p className="mt-1 text-[10px] text-gray-500">
                  Ensure the table exists in your PIB_PRD database.
                </p>
              </div>
            )}

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
                  {form.sourceType === 'FILE' 
                    ? 'Load column names from the CSV, then choose visibility and filters.'
                    : 'Fetch column names from the database warehouse table.'}
                </p>
              </div>
              <button
                type="button"
                onClick={handleLoadColumns}
                disabled={
                  loadingColumns || 
                  (form.sourceType === 'FILE' && !form.filePath && !form.csvContent) ||
                  (form.sourceType === 'WAREHOUSE' && !form.warehouseTable)
                }
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

