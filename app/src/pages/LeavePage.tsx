import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Inspector, type LeaveRequest } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { AuditTrail } from '../components/audit/AuditTrail';

const LEAVE_TYPES = ['Annual leave', 'Sick leave', 'Training', 'Personal', 'Other'];

const emptyForm = {
  inspectorId: '',
  type: 'Annual leave',
  startDate: '',
  endDate: '',
  reason: '',
};

export function LeavePage() {
  const { user } = useAuth();
  const isStaff = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const [items, setItems] = useState<LeaveRequest[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);

  const load = () => api.leaveRequests().then(setItems);

  useEffect(() => {
    load();
    if (isStaff) api.inspectors().then(setInspectors);
  }, [isStaff]);

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
    setError('');
  };

  const startEdit = (leave: LeaveRequest) => {
    setEditingId(leave.id);
    setShowForm(true);
    setForm({
      inspectorId: String(leave.inspector.id),
      type: leave.type,
      startDate: leave.startDate.slice(0, 10),
      endDate: leave.endDate.slice(0, 10),
      reason: leave.reason ?? '',
    });
  };

  const submit = async () => {
    setError('');
    try {
      const payload = {
        type: form.type,
        startDate: form.startDate,
        endDate: form.endDate,
        reason: form.reason || undefined,
        ...(isStaff ? { inspectorId: Number(form.inspectorId) } : {}),
      };

      if (editingId) {
        await api.updateLeave(editingId, payload);
      } else {
        if (isStaff && !form.inspectorId) {
          setError('Select an inspector');
          return;
        }
        await api.createLeave(payload);
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Remove this leave period?')) return;
    await api.deleteLeave(id);
    await load();
  };

  const approve = async (id: number) => {
    setError('');
    try {
      await api.approveLeave(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Approve failed');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy">Leave</h1>
          <p className="text-sm text-slate-500 mt-1">
            {isStaff
              ? 'Record approved leave for any inspector, or approve inspector requests. Approved leave is used by the planner and assignment engine.'
              : 'Submit leave dates for approval. Coordinators can also add leave on your behalf.'}
          </p>
        </div>
        <button type="button" className="btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>
          + Add leave
        </button>
      </div>

      {showForm && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold text-navy">{editingId ? 'Edit leave' : 'Add leave'}</h2>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="grid sm:grid-cols-2 gap-4">
            {isStaff && (
              <div className="sm:col-span-2">
                <label className="text-xs text-slate-500">Inspector</label>
                <select
                  className="input mt-1"
                  value={form.inspectorId}
                  onChange={(e) => setForm({ ...form, inspectorId: e.target.value })}
                  disabled={!!editingId}
                >
                  <option value="">Select inspector…</option>
                  {inspectors.map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.employeeNo})</option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <label className="text-xs text-slate-500">Type</label>
              <select className="input mt-1" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {LEAVE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div />
            <div>
              <label className="text-xs text-slate-500">Start date</label>
              <input className="input mt-1" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">End date</label>
              <input className="input mt-1" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="text-xs text-slate-500">Notes (optional)</label>
              <textarea className="input mt-1" rows={2} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} />
            </div>
          </div>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" onClick={submit}>
              {editingId ? 'Save changes' : 'Add leave'}
            </button>
            <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
          </div>
        </div>
      )}

      {error && !showForm && <p className="text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        {items.length === 0 ? (
          <p className="text-sm text-slate-500 p-6">No leave recorded.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                {isStaff && <th className="p-3">Inspector</th>}
                <th className="p-3">Type</th>
                <th className="p-3">Status</th>
                <th className="p-3">Dates</th>
                <th className="p-3">Notes</th>
                <th className="p-3">Last updated</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {items.map((l) => (
                <tr key={l.id} className="border-t border-slate-100 align-top">
                  {isStaff && (
                    <td className="p-3">
                      <Link to={`/inspectors/${l.inspector.id}`} className="font-medium text-teal hover:underline">
                        {l.inspector.name}
                      </Link>
                    </td>
                  )}
                  <td className="p-3">{l.type}</td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        l.status === 'Approved'
                          ? 'bg-teal/10 text-teal'
                          : l.status === 'Pending'
                            ? 'bg-amber-50 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      {l.status}
                    </span>
                  </td>
                  <td className="p-3 whitespace-nowrap">{l.startDate.slice(0, 10)} — {l.endDate.slice(0, 10)}</td>
                  <td className="p-3 text-slate-600">{l.reason ?? '—'}</td>
                  <td className="p-3 text-xs text-slate-500">
                    {l.updatedByEmail ?? l.createdByEmail ?? '—'}
                    {l.updatedAt && <div>{new Date(l.updatedAt).toLocaleDateString()}</div>}
                  </td>
                  <td className="p-3 whitespace-nowrap">
                    {isStaff && l.status === 'Pending' && (
                      <button type="button" className="text-teal text-xs hover:underline mr-3" onClick={() => approve(l.id)}>
                        Approve
                      </button>
                    )}
                    <button type="button" className="text-teal text-xs hover:underline mr-3" onClick={() => startEdit(l)}>Edit</button>
                    <button type="button" className="text-red-600 text-xs hover:underline" onClick={() => remove(l.id)}>Remove</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AuditTrail entityType="LeaveRequest" title="Leave audit trail" limit={40} />
    </div>
  );
}
