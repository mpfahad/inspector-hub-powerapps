import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, type Client, type Department, type Inspector, type InspectorCert } from '../lib/api';
import { formatMoney } from '../lib/money';
import { useAuth } from '../context/AuthContext';

function certBadgeClass(status: string) {
  if (status === 'Valid') return 'bg-teal/10 text-teal';
  if (status === 'ExpiringSoon') return 'bg-amber-100 text-amber-800';
  if (status === 'Expired') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function QualificationBadges({ certs }: { certs: InspectorCert[] }) {
  if (certs.length === 0) {
    return <span className="text-xs text-slate-400">None on file</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {certs.map((c) => (
        <span
          key={c.id}
          className={`badge ${certBadgeClass(c.status)}`}
          title={`${c.certification.name} · expires ${c.expiresOn.slice(0, 10)}`}
        >
          {c.certification.code}
        </span>
      ))}
    </div>
  );
}

const emptyEmployeeForm = {
  employeeNo: '',
  name: '',
  departmentId: '',
  jobTitle: '',
  email: '',
  hireDate: '',
  baseLocation: '',
  status: 'Active',
  qeApproved: false,
};

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'Active', label: 'Active' },
  { value: 'OnLeave', label: 'On leave' },
  { value: 'Training', label: 'Training' },
  { value: 'Inactive', label: 'Inactive' },
] as const;

function matchesInspectorSearch(i: Inspector, q: string) {
  const hay = [
    i.name,
    i.employeeNo,
    i.jobTitle ?? '',
    i.email ?? '',
    i.department.name,
    i.department.code,
    ...(i.inspectorCerts ?? []).flatMap((c) => [c.certification.code, c.certification.name]),
  ]
    .join(' ')
    .toLowerCase();
  return hay.includes(q);
}

export function InspectorsPage() {
  const { user } = useAuth();
  const isAdminUser = user?.role === 'Admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const urlDept = searchParams.get('dept')?.trim() || '';

  const [items, setItems] = useState<Inspector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState('');
  const [deptFilter, setDeptFilter] = useState(urlDept);
  const [statusFilter, setStatusFilter] = useState('');
  const [qeFilter, setQeFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [form, setForm] = useState(emptyEmployeeForm);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = () => api.inspectors().then(setItems).catch(() => setItems([]));
  useEffect(() => {
    load();
    api.departments().then(setDepartments).catch(() => setDepartments([]));
  }, []);

  useEffect(() => {
    setDeptFilter(urlDept);
  }, [urlDept]);

  useEffect(() => {
    if (!departments.length) return;
    const preferred =
      departments.find((d) => d.name === deptFilter || d.code === deptFilter) ??
      departments.find((d) => d.code === 'RIGS') ??
      departments[0];
    setForm((f) => (f.departmentId ? f : { ...f, departmentId: String(preferred.id) }));
  }, [departments, deptFilter]);

  const setDepartmentFilter = (value: string) => {
    setDeptFilter(value);
    const next = new URLSearchParams(searchParams);
    if (value) next.set('dept', value);
    else next.delete('dept');
    setSearchParams(next, { replace: true });
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((i) => {
      if (deptFilter && i.department.name !== deptFilter && i.department.code !== deptFilter) {
        return false;
      }
      if (statusFilter && i.status !== statusFilter) return false;
      if (qeFilter === 'yes' && !i.qeApproved) return false;
      if (qeFilter === 'no' && i.qeApproved) return false;
      if (q && !matchesInspectorSearch(i, q)) return false;
      return true;
    });
  }, [items, deptFilter, statusFilter, qeFilter, search]);

  const grouped = useMemo(() => {
    const map = new Map<string, { id: number; name: string; code: string; rows: Inspector[] }>();
    for (const i of filtered) {
      const key = String(i.department.id);
      let bucket = map.get(key);
      if (!bucket) {
        bucket = {
          id: i.department.id,
          name: i.department.name,
          code: i.department.code,
          rows: [],
        };
        map.set(key, bucket);
      }
      bucket.rows.push(i);
    }
    for (const bucket of map.values()) {
      bucket.rows.sort((a, b) => a.name.localeCompare(b.name));
    }
    return [...map.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [filtered]);

  const deptCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const i of items) {
      counts.set(i.department.name, (counts.get(i.department.name) ?? 0) + 1);
    }
    return counts;
  }, [items]);

  const filtersActive = Boolean(search.trim() || deptFilter || statusFilter || qeFilter !== 'all');

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('');
    setQeFilter('all');
    setDepartmentFilter('');
  };

  const resetForm = () => {
    const preferred =
      departments.find((d) => d.name === deptFilter || d.code === deptFilter) ??
      departments.find((d) => d.code === 'RIGS') ??
      departments[0];
    setForm({
      ...emptyEmployeeForm,
      departmentId: preferred ? String(preferred.id) : '',
    });
    setError('');
    setShowForm(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.employeeNo.trim() || !form.name.trim() || !form.departmentId) {
      setError('Employee number, name, and department are required.');
      return;
    }
    setSaving(true);
    try {
      await api.createInspector({
        employeeNo: form.employeeNo.trim(),
        name: form.name.trim(),
        departmentId: Number(form.departmentId),
        jobTitle: form.jobTitle.trim() || null,
        email: form.email.trim() || null,
        hireDate: form.hireDate || null,
        baseLocation: form.baseLocation.trim() || null,
        status: form.status,
        qeApproved: form.qeApproved,
      });
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add employee');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Inspectors</h1>
          <p className="text-sm text-slate-500 mt-1">
            {filtered.length === items.length
              ? `${items.length} employees across ${grouped.length || departments.length} departments.`
              : `${filtered.length} of ${items.length} employees match filters.`}
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => (showForm ? resetForm() : setShowForm(true))}
        >
          {showForm ? 'Cancel' : '+ New employee'}
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`px-3 py-1.5 text-sm rounded-lg border ${
            !deptFilter
              ? 'bg-navy text-white border-navy'
              : 'bg-white text-slate-600 border-slate-200 hover:border-teal'
          }`}
          onClick={() => setDepartmentFilter('')}
        >
          All ({items.length})
        </button>
        {departments.map((d) => {
          const count = deptCounts.get(d.name) ?? 0;
          const active = deptFilter === d.name || deptFilter === d.code;
          return (
            <button
              key={d.id}
              type="button"
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                active
                  ? 'bg-navy text-white border-navy'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-teal'
              }`}
              onClick={() => setDepartmentFilter(active ? '' : d.name)}
            >
              {d.name} ({count})
            </button>
          );
        })}
      </div>

      <div className="card p-4 flex flex-col lg:flex-row gap-3 lg:items-end">
        <div className="flex-1 min-w-[12rem]">
          <label className="text-xs text-slate-500">Search</label>
          <input
            type="search"
            className="input mt-1"
            placeholder="Name, employee no, title, cert…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-44">
          <label className="text-xs text-slate-500">Department</label>
          <select
            className="input mt-1"
            value={
              departments.find((d) => d.name === deptFilter || d.code === deptFilter)?.name ?? ''
            }
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.name}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <label className="text-xs text-slate-500">Status</label>
          <select
            className="input mt-1"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value || 'all'} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-full sm:w-40">
          <label className="text-xs text-slate-500">QE approved</label>
          <select
            className="input mt-1"
            value={qeFilter}
            onChange={(e) => setQeFilter(e.target.value as 'all' | 'yes' | 'no')}
          >
            <option value="all">All</option>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
        {filtersActive && (
          <button type="button" className="btn-secondary shrink-0" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-4 max-w-3xl">
          <h2 className="text-sm font-semibold text-navy">Add employee</h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-slate-500">Employee no *</label>
              <input
                className="input mt-1"
                placeholder="e.g. VEQE5144"
                value={form.employeeNo}
                onChange={(e) => setForm((f) => ({ ...f, employeeNo: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Full name *</label>
              <input
                className="input mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Department *</label>
              <select
                className="input mt-1"
                value={form.departmentId}
                onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                required
              >
                <option value="">Select…</option>
                {departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Job title</label>
              <input
                className="input mt-1"
                placeholder="e.g. Electrical Compex Inspector"
                value={form.jobTitle}
                onChange={(e) => setForm((f) => ({ ...f, jobTitle: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Email (optional login)</label>
              <input
                className="input mt-1"
                type="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Engagement / hire date</label>
              <input
                className="input mt-1"
                type="date"
                value={form.hireDate}
                onChange={(e) => setForm((f) => ({ ...f, hireDate: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Base location</label>
              <input
                className="input mt-1"
                value={form.baseLocation}
                onChange={(e) => setForm((f) => ({ ...f, baseLocation: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Status</label>
              <select
                className="input mt-1"
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
              >
                <option value="Active">Active</option>
                <option value="OnLeave">On leave</option>
                <option value="Training">Training</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700 pb-2">
                <input
                  type="checkbox"
                  checked={form.qeApproved}
                  onChange={(e) => setForm((f) => ({ ...f, qeApproved: e.target.checked }))}
                />
                QE approved
              </label>
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save employee'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="space-y-4">
        {grouped.map((group) => (
          <div key={group.id} className="card overflow-hidden">
            <div className="flex items-center justify-between gap-3 px-4 py-3 bg-slate-50 border-b border-slate-100">
              <div>
                <h2 className="font-semibold text-navy">{group.name}</h2>
                <p className="text-xs text-slate-500">{group.code}</p>
              </div>
              <span className="badge bg-white border border-slate-200 text-slate-600">
                {group.rows.length} {group.rows.length === 1 ? 'employee' : 'employees'}
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-white text-left text-xs uppercase text-slate-500">
                  <tr>
                    <th className="p-3">Name</th>
                    <th className="p-3">Employee</th>
                    <th className="p-3">Job title</th>
                    {isAdminUser && (
                      <>
                        <th className="p-3">CTC / day</th>
                        <th className="p-3">Billable / day</th>
                      </>
                    )}
                    <th className="p-3">QE approved</th>
                    <th className="p-3">Qualifications</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {group.rows.map((i) => (
                    <tr key={i.id} className="border-t border-slate-100 align-top">
                      <td className="p-3 font-medium">
                        <Link to={`/inspectors/${i.id}`} className="text-navy hover:text-teal">
                          {i.name}
                        </Link>
                      </td>
                      <td className="p-3">{i.employeeNo}</td>
                      <td className="p-3 text-slate-600">{i.jobTitle || '—'}</td>
                      {isAdminUser && (
                        <>
                          <td className="p-3">{formatMoney(i.dailyCostUsd)}</td>
                          <td className="p-3">{formatMoney(i.dailyBillableUsd)}</td>
                        </>
                      )}
                      <td className="p-3">
                        {i.qeApproved ? (
                          <span className="badge bg-teal/10 text-teal">Yes</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-500">No</span>
                        )}
                      </td>
                      <td className="p-3 max-w-md">
                        <QualificationBadges certs={i.inspectorCerts ?? []} />
                      </td>
                      <td className="p-3">
                        <span className="badge bg-slate-100">{i.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}

        {grouped.length === 0 && (
          <div className="card p-8 text-center text-sm text-slate-500">
            No employees match these filters.
            {filtersActive && (
              <>
                {' '}
                <button type="button" className="text-teal hover:underline" onClick={clearFilters}>
                  Clear filters
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Hover a qualification for full name and expiry. Green = valid, amber = expiring soon, red = expired.
        {isAdminUser ? ' Daily CTC/billable are Admin-only.' : ''}
      </p>
    </div>
  );
}

const emptyClientForm = {
  name: '',
  industry: '',
  location: '',
  latitude: '',
  longitude: '',
};

export function ClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  const [form, setForm] = useState(emptyClientForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => api.clients().then(setItems).catch(() => setItems([]));
  useEffect(() => { load(); }, []);

  const onMap = (c: Client) => c.latitude != null && c.longitude != null;

  const resetForm = () => {
    setForm(emptyClientForm);
    setEditingId(null);
    setError('');
    setShowForm(false);
  };

  const startCreate = () => {
    setForm(emptyClientForm);
    setEditingId(null);
    setError('');
    setShowForm(true);
  };

  const startEdit = (c: Client) => {
    setForm({
      name: c.name,
      industry: c.industry ?? '',
      location: c.location ?? '',
      latitude: c.latitude != null ? String(c.latitude) : '',
      longitude: c.longitude != null ? String(c.longitude) : '',
    });
    setEditingId(c.id);
    setError('');
    setShowForm(true);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }
    const lat = form.latitude.trim() === '' ? null : Number(form.latitude);
    const lng = form.longitude.trim() === '' ? null : Number(form.longitude);
    if ((lat != null && !Number.isFinite(lat)) || (lng != null && !Number.isFinite(lng))) {
      setError('Latitude and longitude must be valid numbers.');
      return;
    }
    if ((lat == null) !== (lng == null)) {
      setError('Provide both latitude and longitude, or leave both blank.');
      return;
    }
    const payload = {
      name: form.name.trim(),
      industry: form.industry.trim() || null,
      location: form.location.trim() || null,
      latitude: lat,
      longitude: lng,
    };
    setSaving(true);
    try {
      if (editingId != null) {
        await api.updateClient(editingId, payload);
      } else {
        await api.createClient(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : editingId != null ? 'Could not update client' : 'Could not create client');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Clients</h1>
          <p className="text-sm text-slate-500 mt-1">
            Clients with coordinates appear on the Jobs map. Known Qatar place names (e.g. Doha, Ras Laffan)
            are geocoded automatically when lat/lng are left blank.
          </p>
        </div>
        <button
          type="button"
          className="btn-primary shrink-0"
          onClick={() => (showForm && editingId == null ? resetForm() : startCreate())}
        >
          {showForm && editingId == null ? 'Cancel' : '+ New client'}
        </button>
      </div>

      {showForm && (
        <form onSubmit={submit} className="card p-5 space-y-4 max-w-2xl">
          <h2 className="text-sm font-semibold text-navy">
            {editingId != null ? 'Edit client' : 'Add client'}
          </h2>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500">Name *</label>
              <input
                className="input mt-1"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Industry</label>
              <input
                className="input mt-1"
                value={form.industry}
                onChange={(e) => setForm((f) => ({ ...f, industry: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Location (city / area)</label>
              <input
                className="input mt-1"
                placeholder="e.g. Doha, Ras Laffan, Al Khor"
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Latitude (optional)</label>
              <input
                className="input mt-1"
                type="number"
                step="any"
                value={form.latitude}
                onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Longitude (optional)</label>
              <input
                className="input mt-1"
                type="number"
                step="any"
                value={form.longitude}
                onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex flex-wrap gap-2">
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Save client'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm} disabled={saving}>
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {items.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-semibold text-navy">{c.name}</div>
                <div className="text-sm text-slate-500 mt-0.5">
                  {[c.industry, c.location].filter(Boolean).join(' · ') || 'No location set'}
                </div>
              </div>
              <div className="flex flex-col items-end gap-2 shrink-0">
                {onMap(c) ? (
                  <span className="badge bg-teal/10 text-teal">On map</span>
                ) : (
                  <span className="badge bg-amber-50 text-amber-800" title="Add lat/lng or a known Qatar place name">
                    No map pin
                  </span>
                )}
                <button type="button" className="text-xs text-teal hover:underline" onClick={() => startEdit(c)}>
                  Edit
                </button>
              </div>
            </div>
            {onMap(c) && (
              <p className="text-xs text-slate-400 mt-2">
                {c.latitude!.toFixed(4)}, {c.longitude!.toFixed(4)}
              </p>
            )}
          </div>
        ))}
      </div>
      {items.length === 0 && <p className="text-sm text-slate-500">No clients yet. Add one to use on jobs and the map.</p>}
    </div>
  );
}
