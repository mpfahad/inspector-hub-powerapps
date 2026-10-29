import { useEffect, useState } from 'react';
import { api, type ActivityLog } from '../../lib/api';

type Props = {
  jobId: number;
  inspectorId?: number;
  canLog?: boolean;
  defaultInspectorId?: number;
};

const emptyForm = {
  logDate: new Date().toISOString().slice(0, 10),
  hours: '8',
  productiveHours: '7.2',
  narrative: '',
  qualityScore: '90',
};

export function ActivityLogPanel({ jobId, inspectorId, canLog, defaultInspectorId }: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    api.activityLogs({ jobId, inspectorId }).then(setLogs).catch(() => setLogs([]));

  useEffect(() => {
    load();
  }, [jobId, inspectorId]);

  const saveNew = async () => {
    if (!defaultInspectorId) return;
    setError('');
    try {
      await api.createActivityLog({
        jobId,
        inspectorId: defaultInspectorId,
        logDate: form.logDate,
        hours: Number(form.hours),
        productiveHours: Number(form.productiveHours),
        narrative: form.narrative || undefined,
        qualityScore: form.qualityScore ? Number(form.qualityScore) : undefined,
      });
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save log');
    }
  };

  const saveEdit = async (log: ActivityLog) => {
    setError('');
    try {
      await api.updateActivityLog(log.id, {
        logDate: form.logDate,
        hours: Number(form.hours),
        productiveHours: Number(form.productiveHours),
        narrative: form.narrative || undefined,
        qualityScore: form.qualityScore ? Number(form.qualityScore) : undefined,
      });
      setEditingId(null);
      setForm(emptyForm);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update log');
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this activity log?')) return;
    await api.deleteActivityLog(id);
    await load();
  };

  const startEdit = (log: ActivityLog) => {
    setEditingId(log.id);
    setForm({
      logDate: log.logDate.slice(0, 10),
      hours: String(log.hours),
      productiveHours: String(log.productiveHours),
      narrative: log.narrative ?? '',
      qualityScore: log.qualityScore != null ? String(log.qualityScore) : '',
    });
  };

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold text-navy">Activity logs</h2>
          <p className="text-sm text-slate-500 mt-1">{logs.length} entries · {totalHours.toFixed(1)} h total</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {canLog && defaultInspectorId && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <h3 className="text-sm font-medium text-navy">{editingId ? 'Edit entry' : 'Log activity'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500">Date</label>
              <input className="input mt-1" type="date" value={form.logDate} onChange={(e) => setForm({ ...form, logDate: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Hours</label>
              <input className="input mt-1" value={form.hours} onChange={(e) => setForm({ ...form, hours: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Productive hrs</label>
              <input className="input mt-1" value={form.productiveHours} onChange={(e) => setForm({ ...form, productiveHours: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-slate-500">Quality %</label>
              <input className="input mt-1" value={form.qualityScore} onChange={(e) => setForm({ ...form, qualityScore: e.target.value })} />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Narrative</label>
            <textarea className="input mt-1" rows={2} value={form.narrative} onChange={(e) => setForm({ ...form, narrative: e.target.value })} />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              onClick={() => {
                if (editingId) {
                  const log = logs.find((l) => l.id === editingId);
                  if (log) saveEdit(log);
                } else {
                  saveNew();
                }
              }}
            >
              {editingId ? 'Save changes' : 'Add log'}
            </button>
            {editingId && (
              <button type="button" className="btn-secondary text-sm" onClick={() => { setEditingId(null); setForm(emptyForm); }}>
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {logs.length === 0 ? (
        <p className="text-sm text-slate-500">No activity logged yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2 pr-3">Date</th>
                <th className="py-2 pr-3">Inspector</th>
                <th className="py-2 pr-3">Hours</th>
                <th className="py-2 pr-3">Productive</th>
                <th className="py-2 pr-3">Narrative</th>
                {canLog && <th className="py-2" />}
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr key={log.id} className="border-b border-slate-50 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{log.logDate.slice(0, 10)}</td>
                  <td className="py-2 pr-3">{log.inspector.name}</td>
                  <td className="py-2 pr-3">{log.hours}</td>
                  <td className="py-2 pr-3">{log.productiveHours}</td>
                  <td className="py-2 pr-3 text-slate-600 max-w-xs">{log.narrative ?? '—'}</td>
                  {canLog && (
                    <td className="py-2 whitespace-nowrap">
                      <button type="button" className="text-teal text-xs hover:underline mr-2" onClick={() => startEdit(log)}>Edit</button>
                      <button type="button" className="text-red-600 text-xs hover:underline" onClick={() => remove(log.id)}>Delete</button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
