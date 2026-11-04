import { useEffect, useState } from 'react';
import { api, type Client, type Department, type JobDetail } from '../../lib/api';

const EDITABLE = ['Draft', 'Proposed'];

type Props = {
  job: JobDetail;
  clients: Client[];
  departments: Department[];
  onSaved: () => void;
};

export function JobEditPanel({ job, clients, departments, onSaved }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: job.title,
    scope: job.scope ?? '',
    location: job.location ?? '',
    startDate: job.startDate.slice(0, 10),
    endDate: job.endDate.slice(0, 10),
    priority: job.priority,
    estimatedHours: String(job.estimatedHours),
    clientId: String(job.client.id),
    departmentId: String(job.department.id),
    requiresQeApproval: Boolean(job.requiresQeApproval),
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setForm({
      title: job.title,
      scope: job.scope ?? '',
      location: job.location ?? '',
      startDate: job.startDate.slice(0, 10),
      endDate: job.endDate.slice(0, 10),
      priority: job.priority,
      estimatedHours: String(job.estimatedHours),
      clientId: String(job.client.id),
      departmentId: String(job.department.id),
      requiresQeApproval: Boolean(job.requiresQeApproval),
    });
  }, [job]);

  if (!EDITABLE.includes(job.status)) return null;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await api.updateJob(job.id, {
        title: form.title,
        scope: form.scope || undefined,
        location: form.location || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        priority: form.priority,
        estimatedHours: Number(form.estimatedHours),
        clientId: Number(form.clientId),
        departmentId: Number(form.departmentId),
        requiresQeApproval: form.requiresQeApproval,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  if (!open) {
    return (
      <button type="button" className="btn-secondary text-sm" onClick={() => setOpen(true)}>
        Edit job details
      </button>
    );
  }

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-navy">Edit job</h2>
        <button type="button" className="text-sm text-slate-500 hover:text-navy" onClick={() => setOpen(false)}>Close</button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500">Title</label>
          <input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Client</label>
          <select className="input mt-1" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Department</label>
          <select className="input mt-1" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Start date</label>
          <input className="input mt-1" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">End date</label>
          <input className="input mt-1" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
        </div>
        <div>
          <label className="text-xs text-slate-500">Priority</label>
          <select className="input mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['Low', 'Normal', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div>
          <label className="text-xs text-slate-500">Estimated hours</label>
          <input className="input mt-1" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500">Location</label>
          <input
            className="input mt-1"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Doha, Ras Laffan, Mesaieed"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="flex items-start gap-3 cursor-pointer rounded-lg border border-slate-200 p-3">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.requiresQeApproval}
              onChange={(e) => setForm({ ...form, requiresQeApproval: e.target.checked })}
            />
            <span>
              <span className="text-sm font-medium text-navy">Prefers QE-approved inspector</span>
              <p className="text-xs text-slate-500 mt-0.5">
                If on, QE-approved staff are preferred. Non–QE staff stay selectable with a warning; assigners may override. Assign still makes the job Active immediately.
              </p>
            </span>
          </label>
        </div>
        <div className="sm:col-span-2">
          <label className="text-xs text-slate-500">Scope</label>
          <textarea className="input mt-1" rows={3} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} />
        </div>
      </div>
      <button type="button" className="btn-primary" disabled={saving} onClick={save}>
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </div>
  );
}
