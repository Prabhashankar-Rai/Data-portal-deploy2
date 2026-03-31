'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { getClientRole } from '../../lib/auth';
import { logAction } from '../../lib/audit';

type FilterType = 'none' | 'date' | 'multi' | 'text' | 'number';

type ColumnConfig = {
  name: string;
  visible: boolean;
  filter: FilterType;
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
  hasDownload?: boolean;
  hasView?: boolean;
  hasAIChat?: boolean;
};

export default function Download() {
  const pathname = usePathname();
  useEffect(() => {
    const role = getClientRole();
    if (role) {
      logAction(role, 'page_visit', pathname);
    }
  }, [pathname]);

  const [step, setStep] = useState(1);
  const [dataType, setDataType] = useState<string | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [filters, setFilters] = useState<
    Record<string, { operator: string; value: string | string[] | [string, string] }>
  >({});
  
  const [filterOptions, setFilterOptions] = useState<Record<string, string[]>>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [openFilterDropdown, setOpenFilterDropdown] = useState<string | null>(null);
  const [datasets, setDatasets] = useState<DatasetConfig[]>([]);
  const [currentDataset, setCurrentDataset] = useState<DatasetConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [loadingMetadata, setLoadingMetadata] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);

  useEffect(() => {
    const loadDatasets = async () => {
      try {
        const res = await fetch('/api/datasets');
        if (!res.ok) return;
        const json = (await res.json()) as DatasetConfig[];
        setDatasets(json.filter(d => d.hasDownload || d.hasView));
      } catch {}
    };
    loadDatasets();
  }, []);

  const handleDataTypeSelect = async (dataset: DatasetConfig) => {
    setLoadError(null);
    setLoadingMetadata(dataset.id);
    
    // We only want metadata (columns and filter options) to avoid crashing browser memory
    try {
      const res = await fetch(`/api/datasets/${encodeURIComponent(dataset.id)}/data?meta=true`);
      if (!res.ok) {
        let message = 'Unable to load dataset metadata.';
        try {
          const body = await res.json();
          if (body?.error) message = body.error as string;
        } catch { }
        setLoadError(message);
        return;
      }
      
      const payload = await res.json();
      
      const visibleColumns =
        dataset.columns && dataset.columns.length > 0
          ? dataset.columns.filter(c => c.visible).map(c => c.name)
          : payload.columns || [];
          
      setColumns(visibleColumns);
      setSelectedColumns(visibleColumns);
      setFilterOptions(payload.filterOptions || {});
      setDataType(dataset.id);
      setCurrentDataset(dataset);
      setFilters({});
      setStep(2);
    } catch (error: any) {
      const message =
        (error && typeof error.message === 'string' && error.message) ||
        'Unable to load dataset.';
      setLoadError(message);
    } finally {
      setLoadingMetadata(null);
    }
  };

  const handleColumnToggle = (col: string) => {
    setSelectedColumns(prev =>
      prev.includes(col) ? prev.filter(c => c !== col) : [...prev, col]
    );
  };

  const handleFilterChange = (
    col: string,
    operator: string,
    value: string | string[] | [string, string]
  ) => {
    setFilters(prev => ({ ...prev, [col]: { operator, value } }));
  };

  const columnFilterConfig: Record<string, 'multi' | 'date' | 'none'> = {
    src: 'multi',
    mtd_flag: 'multi',
    mly_flag: 'multi',
    reporting_line: 'multi',
    reporting_branch: 'multi',
    child_branch_code: 'multi',
    source: 'multi',
    channel: 'multi',
    lob: 'multi',
    policy_type: 'multi',
    ac_date: 'date',
    nop_t: 'none',
    nor_t: 'none',
    nop_total_epr: 'none',
    nor_total_epr: 'none',
    gwp: 'none',
    nwp: 'none',
    gep: 'none',
    nep: 'none',
    noc: 'none',
    gic: 'none',
    nic: 'none',
    gos: 'none',
    nos: 'none',
    gpd: 'none',
    npd: 'none',
  };

  function getFilterType(col: string) {
    if (currentDataset && currentDataset.columns && currentDataset.columns.length > 0) {
      const columnCfg = currentDataset.columns.find(
        c => c.name.trim().toLowerCase() === col.trim().toLowerCase(),
      );
      if (columnCfg) {
        if (columnCfg.filter === 'none') return null;
        if (columnCfg.filter === 'date') return 'date';
        if (columnCfg.filter === 'multi') return 'multi';
        if (columnCfg.filter === 'text') return 'text';
        if (columnCfg.filter === 'number') return 'number';
      }
    }
    const cLabel = col.trim().toLowerCase() as keyof typeof columnFilterConfig;
    if (columnFilterConfig[cLabel]) {
      const type = columnFilterConfig[cLabel];
      return type === 'none' ? null : type;
    }
    return null;
  }

  const actPreview = async () => {
    setIsPreviewing(true);
    setPreview([]);
    try {
       const res = await fetch(`/api/datasets/${encodeURIComponent(currentDataset!.id)}/data`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ action: 'preview', filters, selectedColumns })
       });
       if (!res.ok) throw new Error('Preview failed');
       const data = await res.json();
       setPreview(data.rows || []);
       setStep(4);
    } catch (e) {
       console.error(e);
       setStep(4);
    } finally {
       setIsPreviewing(false);
    }
  };

  const hasFilterableColumns = selectedColumns.some(col => getFilterType(col));

  return (
    <div className="min-h-screen bg-gray-50/50 p-6 md:p-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">
            Data Download
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Select a dataset, choose columns, apply filters, and download.
          </p>
        </header>

        {/* Multi-step progress indicator */}
        <div className="mb-8">
          <nav aria-label="Progress">
            <ol role="list" className="flex items-center">
              {[
                { id: 1, name: 'Dataset' },
                { id: 2, name: 'Columns' },
                { id: 3, name: 'Filters' },
                { id: 4, name: 'Download' },
              ].map((s, sIdx) => (
                <li
                  key={s.name}
                  className={sIdx !== 3 ? 'relative pr-8 sm:pr-20' : 'relative'}
                >
                  <div className="flex items-center">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
                        step > s.id
                          ? 'border-blue-600 bg-blue-600 text-white'
                          : step === s.id
                            ? 'border-blue-600 bg-white text-blue-600'
                            : 'border-gray-300 bg-white text-gray-400'
                      }`}
                    >
                      {step > s.id ? (
                        <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                            clipRule="evenodd"
                          />
                        </svg>
                      ) : (
                        <span className="text-xs font-semibold">{s.id}</span>
                      )}
                    </div>
                    {sIdx !== 3 && (
                      <div
                        className={`absolute left-0 top-1/2 ml-10 hidden w-full -translate-y-1/2 before:absolute before:inset-0 before:h-0.5 sm:block ${
                          step > s.id ? 'before:bg-blue-600' : 'before:bg-gray-200'
                        }`}
                      ></div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
          </nav>
        </div>

        {/* Step 1 */}
        {step === 1 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Available Datasets
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Select a dataset to begin filtering and downlading.
              </p>
            </div>
            {loadError && (
              <div className="mb-6 rounded-md bg-red-50 p-4 text-sm text-red-700">
                {loadError}
              </div>
            )}
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {datasets
                .map(dataset => (
                  <button
                    key={dataset.id}
                    onClick={() => handleDataTypeSelect(dataset)}
                    disabled={loadingMetadata !== null}
                    className={`relative flex flex-col items-start gap-4 rounded-xl border border-gray-200 p-6 text-left shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                      dataType === dataset.id
                        ? 'border-blue-600 ring-2 ring-blue-600'
                        : 'hover:border-blue-300 hover:shadow-md'
                    } ${loadingMetadata !== null && loadingMetadata !== dataset.id ? 'opacity-50 cursor-not-allowed' : ''} ${loadingMetadata === dataset.id ? 'ring-2 ring-blue-300 border-blue-300' : ''}`}
                  >
                    <div className="flex w-full gap-4 items-start text-left">
                      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-600 shrink-0">
                        {loadingMetadata === dataset.id ? (
                           <svg className="h-6 w-6 animate-spin text-blue-600" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                           </svg>
                        ) : (
                          <svg
                            className="h-6 w-6"
                            fill="none"
                            viewBox="0 0 24 24"
                            strokeWidth="1.5"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z"
                            />
                          </svg>
                        )}
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-gray-900">
                          {dataset.displayLabel ||
                            dataset.id[0].toUpperCase() + dataset.id.slice(1)} Data
                        </h3>
                        <p className="mt-2 text-sm text-gray-500 line-clamp-2 leading-relaxed">
                          {dataset.purpose || `Export the latest ${dataset.id} dataset`}
                        </p>
                      </div>
                    </div>
                  </button>
              ))}
            </div>
            {datasets.length === 0 && (
              <p className="text-gray-500">No datasets available.</p>
            )}
          </div>
        )}

        {/* Step 2 */}
        {step === 2 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Select Columns{dataType ? ` – ${dataType[0].toUpperCase()}${dataType.slice(1)} Data` : ''}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Choose the data fields you need.
              </p>
            </div>
            <div className="mb-8 grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {columns.map((col, idx) => (
                <label
                  key={`${col}-${idx}`}
                  className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm transition ${
                    selectedColumns.includes(col)
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-200 bg-gray-50 hover:border-blue-300'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedColumns.includes(col)}
                    onChange={() => handleColumnToggle(col)}
                    className="h-4 w-4 accent-blue-600"
                  />
                  <span className="truncate font-medium">{col}</span>
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep(1);
                  setDataType(null);
                  setColumns([]);
                  setSelectedColumns([]);
                  setFilters({});
                  setFilterOptions({});
                  setPreview([]);
                }}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                disabled={selectedColumns.length === 0}
                onClick={() => setStep(3)}
                className="rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300"
              >
                Next: Filters
              </button>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {step === 3 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Apply Filters
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Narrow down your dataset based on the selected columns.
              </p>
            </div>

            {hasFilterableColumns ? (
              <div className="mb-8 rounded-2xl border border-gray-100 bg-white">
                <div className="border-b border-gray-100 px-6 py-4">
                  <h3 className="text-sm font-semibold text-gray-900">
                    Apply Filters
                  </h3>
                  <p className="mt-1 text-xs text-gray-500">
                    Select values from dropdowns to narrow your dataset.
                  </p>
                </div>
                <div
                  className="p-6"
                  onClick={() => setOpenFilterDropdown(null)}
                >
                  {(() => {
                    const filterOrder = [
                      'src',
                      'mtd_flag',
                      'mly_flag',
                      'ac_date',
                      'reporting_line',
                      'reporting_branch',
                      'child_branch_code',
                      'source',
                      'channel',
                      'lob',
                      'policy_type',
                    ];

                    const filterable = selectedColumns
                      .filter(col => getFilterType(col))
                      .sort((a, b) => {
                        const ai = filterOrder.indexOf(a.trim().toLowerCase());
                        const bi = filterOrder.indexOf(b.trim().toLowerCase());
                        const ax = ai === -1 ? 999 : ai;
                        const bx = bi === -1 ? 999 : bi;
                        return ax - bx;
                      });

                    return (
                      <div className="grid gap-6 md:grid-cols-2">
                        {filterable.map(col => {
                          const filterType = getFilterType(col);
                          if (!filterType) return null;

                          const options = filterOptions[col] || [];

                          const label = col
                            .split('_')
                            .map(s => (s ? s[0].toUpperCase() + s.slice(1) : s))
                            .join(' ');

                          if (filterType === 'date') {
                            const op = filters[col]?.operator || '';
                            const current = filters[col]?.value;
                            const currentStart = Array.isArray(current) && current.length > 0 ? current[0] : '';
                            const currentEnd = Array.isArray(current) && current.length > 1 ? current[1] : '';

                            return (
                              <div key={col} className="space-y-2">
                                <label className="block text-xs font-semibold text-gray-700">
                                  {label}
                                </label>
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                  <select
                                    value={op}
                                    onChange={e =>
                                      handleFilterChange(
                                        col,
                                        e.target.value,
                                        e.target.value === 'between'
                                          ? [currentStart, currentEnd]
                                          : typeof current === 'string'
                                            ? current
                                            : '',
                                      )
                                    }
                                    className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100 sm:w-40"
                                  >
                                    <option value="">All Dates</option>
                                    <option value="eq">Equal to</option>
                                    <option value="between">Between</option>
                                  </select>
                                  {op === 'between' && (
                                    <div className="flex flex-1 flex-col gap-2 sm:flex-row">
                                      <input
                                        type="date"
                                        value={currentStart}
                                        onChange={e =>
                                          handleFilterChange(col, 'between', [e.target.value, currentEnd])
                                        }
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                      />
                                      <input
                                        type="date"
                                        value={currentEnd}
                                        onChange={e =>
                                          handleFilterChange(col, 'between', [currentStart, e.target.value])
                                        }
                                        className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                      />
                                    </div>
                                  )}
                                  {op === 'eq' && (
                                    <input
                                      type="date"
                                      value={typeof current === 'string' ? current : ''}
                                      onChange={e =>
                                        handleFilterChange(col, 'eq', e.target.value)
                                      }
                                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                    />
                                  )}
                                </div>
                              </div>
                            );
                          }

                          if (filterType === 'multi') {
                            const selectedValues = Array.isArray(filters[col]?.value)
                              ? (filters[col]?.value as string[])
                              : [];

                            const summaryText =
                              selectedValues.length === 0
                                ? `All ${label}`
                                : selectedValues.length === 1
                                  ? selectedValues[0]
                                  : `${selectedValues.length} selected`;

                            const isOpen = openFilterDropdown === col;

                            const toggleValue = (val: string) => {
                              const next = selectedValues.includes(val)
                                ? selectedValues.filter(v => v !== val)
                                : [...selectedValues, val];
                              handleFilterChange(col, 'in', next);
                            };

                            return (
                              <div key={col} className="space-y-2">
                                <label className="block text-xs font-semibold text-gray-700">
                                  {label}
                                </label>
                                <div className="relative">
                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      setOpenFilterDropdown(isOpen ? null : col);
                                    }}
                                    className="flex w-full items-center justify-between rounded-lg border border-gray-300 bg-white px-3 py-2 text-left text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                  >
                                    <span className="truncate">{summaryText}</span>
                                    <span className="ml-2 text-gray-400">▾</span>
                                  </button>
                                  {isOpen && (
                                    <div
                                      className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-gray-200 bg-white shadow-lg"
                                      onClick={e => e.stopPropagation()}
                                    >
                                      <div className="p-2 text-xs text-gray-400">
                                        Select one or more values
                                      </div>
                                      {options.map(val => {
                                        const v = `${val}`;
                                        const checked = selectedValues.includes(v);
                                        return (
                                          <label
                                            key={v}
                                            className="flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-gray-800 hover:bg-blue-50"
                                          >
                                            <input
                                              type="checkbox"
                                              className="h-4 w-4 accent-blue-600"
                                              checked={checked}
                                              onChange={() => toggleValue(v)}
                                            />
                                            <span className="truncate">{v}</span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          }

                          return (
                            <div key={col} className="space-y-2">
                              <label className="block text-xs font-semibold text-gray-700">
                                {label}
                              </label>
                              <select
                                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                                value={
                                  typeof filters[col]?.value === 'string'
                                    ? (filters[col]?.value as string)
                                    : ''
                                }
                                onChange={e => handleFilterChange(col, 'eq', e.target.value)}
                              >
                                <option value="">{`All ${label}`}</option>
                                {options.map(val => (
                                  <option key={`${val}`} value={`${val}`}>
                                    {`${val}`}
                                  </option>
                                ))}
                              </select>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <p className="mb-8 text-sm text-gray-500">
                No filters available for the selected columns. You can still
                preview and download the data.
              </p>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Back
              </button>
              <button
                type="button"
                onClick={actPreview}
                disabled={isPreviewing}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed min-w-[140px] justify-center"
              >
                {isPreviewing && (
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{isPreviewing ? 'Loading...' : 'Preview Data'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Step 4 */}
        {step === 4 && (
          <div className="rounded-2xl bg-white p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900">
                Data Preview
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                Showing the first 10 rows of your filtered dataset.
              </p>
            </div>
            <div className="mb-6 overflow-auto rounded-xl border border-gray-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {selectedColumns.map((col, idx) => (
                      <th
                        key={`${col}-${idx}`}
                        className="border-b border-gray-200 px-4 py-2 font-semibold text-gray-700 whitespace-nowrap"
                      >
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {preview.length === 0 ? (
                    <tr>
                      <td
                        colSpan={Math.max(selectedColumns.length, 1)}
                        className="px-4 py-6 text-center text-sm text-gray-500"
                      >
                        No rows found for the selected filters.
                      </td>
                    </tr>
                  ) : (
                    preview.map((row, i) => (
                      <tr key={i} className="odd:bg-white even:bg-gray-50">
                        {selectedColumns.map((col, idx) => (
                          <td key={`${col}-${idx}`} className="px-4 py-2 text-gray-800 whitespace-nowrap">
                            {row[col]}
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-lg border border-gray-300 bg-white px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:cursor-pointer"
              >
                Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    setIsDownloading(true);
                    const res = await fetch(`/api/datasets/${encodeURIComponent(currentDataset!.id)}/data`, {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ action: 'export', filters, selectedColumns })
                    });
                    if (!res.ok) throw new Error('Download failed');
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `${dataType || 'dataset'}-filtered.csv`;
                    a.click();
                    URL.revokeObjectURL(url);

                    setTimeout(() => {
                      setStep(1);
                      setDataType(null);
                      setColumns([]);
                      setSelectedColumns([]);
                      setFilters({});
                      setFilterOptions({});
                      setPreview([]);
                    }, 500);
                  } catch (e) {
                      console.error(e);
                  } finally {
                      setIsDownloading(false);
                  }
                }}
                disabled={!currentDataset?.hasDownload || isDownloading}
                title={!currentDataset?.hasDownload ? "You only have View access for this dataset, Download is disabled." : ""}
                className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed min-w-[180px] justify-center"
              >
                {isDownloading && (
                  <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>{isDownloading ? 'Downloading...' : 'Verify & Download'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}