import { useEffect, useMemo, useState } from 'react';
import { api, type ActivityLog } from '../../lib/api';

type Props = {
  jobId: number;
  inspectorId?: number;
  canLog?: boolean;
  defaultInspectorId?: number;
  /** Optional defaults for multi-day range (YYYY-MM-DD). */
  defaultFrom?: string;
  defaultTo?: string;
};

type Mode = 'single' | 'multi';

type DayRow = {
  logDate: string;
  hours: string;
  productiveHours: string;
  qualityScore: string;
  include: boolean;
  alreadyLogged: boolean;
};

const emptyForm = {
  logDate: new Date().toISOString().slice(0, 10),
  hours: '8',
  productiveHours: '7.2',
  narrative: '',
  qualityScore: '90',
};

function addDays(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function eachDateInclusive(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 62) {
    out.push(cur);
    cur = addDays(cur, 1);
    guard += 1;
  }
  return out;
}

function productiveFromHours(hours: string) {
  const n = Number(hours);
  if (!Number.isFinite(n) || n <= 0) return '0';
  return (Math.round(n * 0.9 * 10) / 10).toString();
}

export function ActivityLogPanel({
  jobId,
  inspectorId,
  canLog,
  defaultInspectorId,
  defaultFrom,
  defaultTo,
}: Props) {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [mode, setMode] = useState<Mode>('single');
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [saving, setSaving] = useState(false);

  const [rangeFrom, setRangeFrom] = useState(defaultFrom || emptyForm.logDate);
  const [rangeTo, setRangeTo] = useState(defaultTo || emptyForm.logDate);
  const [defaultHours, setDefaultHours] = useState('8');
  const [defaultQuality, setDefaultQuality] = useState('90');
  const [sharedNarrative, setSharedNarrative] = useState('');
  const [rows, setRows] = useState<DayRow[]>([]);

  const load = () =>
    api.activityLogs({ jobId, inspectorId }).then(setLogs).catch(() => setLogs([]));

  useEffect(() => {
    load();
  }, [jobId, inspectorId]);

  useEffect(() => {
    if (defaultFrom) setRangeFrom(defaultFrom);
    if (defaultTo) setRangeTo(defaultTo);
  }, [defaultFrom, defaultTo]);

  const loggedKeys = useMemo(() => {
    const set = new Set<string>();
    for (const l of logs) {
      if (defaultInspectorId && l.inspectorId !== defaultInspectorId) continue;
      set.add(l.logDate.slice(0, 10));
    }
    return set;
  }, [logs, defaultInspectorId]);

  const buildRows = (from = rangeFrom, to = rangeTo, hours = defaultHours, quality = defaultQuality) => {
    const dates = eachDateInclusive(from, to);
    setRows(
      dates.map((logDate) => {
        const alreadyLogged = loggedKeys.has(logDate);
        return {
          logDate,
          hours: alreadyLogged ? '0' : hours,
          productiveHours: alreadyLogged ? '0' : productiveFromHours(hours),
          qualityScore: quality,
          include: !alreadyLogged,
          alreadyLogged,
        };
      })
    );
  };

  useEffect(() => {
    if (mode !== 'multi') return;
    setRows((prev) => {
      if (prev.length === 0) {
        return eachDateInclusive(rangeFrom, rangeTo).map((logDate) => {
          const alreadyLogged = loggedKeys.has(logDate);
          return {
            logDate,
            hours: alreadyLogged ? '0' : defaultHours,
            productiveHours: alreadyLogged ? '0' : productiveFromHours(defaultHours),
            qualityScore: defaultQuality,
            include: !alreadyLogged,
            alreadyLogged,
          };
        });
      }
      return prev.map((r) => {
        const alreadyLogged = loggedKeys.has(r.logDate);
        if (!alreadyLogged) return { ...r, alreadyLogged: false };
        return {
          ...r,
          alreadyLogged: true,
          include: false,
          hours: '0',
          productiveHours: '0',
        };
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, loggedKeys]);

  const includedRows = rows.filter((r) => r.include && !r.alreadyLogged && Number(r.hours) > 0);
  const multiTotalHours = includedRows.reduce((s, r) => s + (Number(r.hours) || 0), 0);

  const saveNew = async () => {
    if (!defaultInspectorId) return;
    setError('');
    setInfo('');
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const saveEdit = async (log: ActivityLog) => {
    setError('');
    setInfo('');
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
  };

  const saveMulti = async () => {
    if (!defaultInspectorId) return;
    setError('');
    setInfo('');
    if (includedRows.length === 0) {
      setError('Select at least one day with hours greater than 0.');
      return;
    }
    setSaving(true);
    try {
      const result = await api.createActivityLogsBatch({
        jobId,
        inspectorId: defaultInspectorId,
        entries: includedRows.map((r) => ({
          logDate: r.logDate,
          hours: Number(r.hours),
          productiveHours: Number(r.productiveHours) || 0,
          narrative: sharedNarrative || undefined,
          qualityScore: r.qualityScore ? Number(r.qualityScore) : undefined,
        })),
      });
      const skippedExisting = rows.filter((r) => r.alreadyLogged).length;
      setInfo(
        `Saved ${result.created.length} day${result.created.length === 1 ? '' : 's'}` +
          (result.skipped.length || skippedExisting
            ? ` · skipped ${result.skipped.length} (already logged or empty)`
            : '')
      );
      setSharedNarrative('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save logs');
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number) => {
    if (!confirm('Delete this activity log?')) return;
    await api.deleteActivityLog(id);
    await load();
  };

  const startEdit = (log: ActivityLog) => {
    setMode('single');
    setEditingId(log.id);
    setForm({
      logDate: log.logDate.slice(0, 10),
      hours: String(log.hours),
      productiveHours: String(log.productiveHours),
      narrative: log.narrative ?? '',
      qualityScore: log.qualityScore != null ? String(log.qualityScore) : '',
    });
  };

  const updateRow = (logDate: string, patch: Partial<DayRow>) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.logDate !== logDate) return r;
        const next = { ...r, ...patch };
        if (patch.hours != null && patch.productiveHours === undefined) {
          next.productiveHours = productiveFromHours(patch.hours);
        }
        return next;
      })
    );
  };

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const rangeTooLong = eachDateInclusive(rangeFrom, rangeTo).length > 62;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy">Activity logs</h2>
          <p className="text-sm text-slate-500 mt-1">
            {logs.length} entries · {totalHours.toFixed(1)} h total
          </p>
        </div>
        {canLog && defaultInspectorId && !editingId && (
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50 self-start">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md ${mode === 'single' ? 'bg-white shadow-sm font-medium text-navy' : 'text-slate-500'}`}
              onClick={() => setMode('single')}
            >
              Single day
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md ${mode === 'multi' ? 'bg-white shadow-sm font-medium text-navy' : 'text-slate-500'}`}
              onClick={() => {
                setMode('multi');
                buildRows();
              }}
            >
              Multi-day
            </button>
          </div>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {info && <p className="text-sm text-teal">{info}</p>}

      {canLog && defaultInspectorId && mode === 'single' && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-3 bg-slate-50/50">
          <h3 className="text-sm font-medium text-navy">{editingId ? 'Edit entry' : 'Log activity — single day'}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500">Date</label>
              <input
                className="input mt-1"
                type="date"
                value={form.logDate}
                onChange={(e) => setForm({ ...form, logDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Hours</label>
              <input
                className="input mt-1"
                value={form.hours}
                onChange={(e) => {
                  const hours = e.target.value;
                  setForm({ ...form, hours, productiveHours: productiveFromHours(hours) });
                }}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Productive hrs</label>
              <input
                className="input mt-1"
                value={form.productiveHours}
                onChange={(e) => setForm({ ...form, productiveHours: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Quality %</label>
              <input
                className="input mt-1"
                value={form.qualityScore}
                onChange={(e) => setForm({ ...form, qualityScore: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="text-xs text-slate-500">Narrative</label>
            <textarea
              className="input mt-1"
              rows={2}
              value={form.narrative}
              onChange={(e) => setForm({ ...form, narrative: e.target.value })}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={saving}
              onClick={() => {
                if (editingId) {
                  const log = logs.find((l) => l.id === editingId);
                  if (log) saveEdit(log);
                } else {
                  saveNew();
                }
              }}
            >
              {saving ? 'Saving…' : editingId ? 'Save changes' : 'Add log'}
            </button>
            {editingId && (
              <button
                type="button"
                className="btn-secondary text-sm"
                disabled={saving}
                onClick={() => {
                  setEditingId(null);
                  setForm(emptyForm);
                }}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}

      {canLog && defaultInspectorId && mode === 'multi' && !editingId && (
        <div className="rounded-lg border border-slate-200 p-4 space-y-4 bg-slate-50/50">
          <div>
            <h3 className="text-sm font-medium text-navy">Log activity — multiple days</h3>
            <p className="text-xs text-slate-500 mt-1">
              Set a date range, fill hours per day, then save once. Days that already have a log are skipped.
            </p>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-xs text-slate-500">From</label>
              <input
                className="input mt-1"
                type="date"
                value={rangeFrom}
                onChange={(e) => setRangeFrom(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">To</label>
              <input
                className="input mt-1"
                type="date"
                value={rangeTo}
                onChange={(e) => setRangeTo(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Default hours / day</label>
              <input
                className="input mt-1"
                value={defaultHours}
                onChange={(e) => setDefaultHours(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Default quality %</label>
              <input
                className="input mt-1"
                value={defaultQuality}
                onChange={(e) => setDefaultQuality(e.target.value)}
              />
            </div>
          </div>
          <button
            type="button"
            className="btn-secondary text-sm"
            onClick={() => buildRows()}
            disabled={rangeTooLong || !rangeFrom || !rangeTo || rangeFrom > rangeTo}
          >
            Build day list
          </button>
          {rangeTooLong && (
            <p className="text-xs text-amber-800">Range is limited to 62 days. Shorten From / To.</p>
          )}
          {rangeFrom > rangeTo && (
            <p className="text-xs text-amber-800">From must be on or before To.</p>
          )}

          {rows.length > 0 && (
            <>
              <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50">
                    <tr>
                      <th className="p-2 w-10">Incl.</th>
                      <th className="p-2">Date</th>
                      <th className="p-2">Hours</th>
                      <th className="p-2">Productive</th>
                      <th className="p-2">Quality %</th>
                      <th className="p-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r) => (
                      <tr
                        key={r.logDate}
                        className={`border-t border-slate-100 ${r.alreadyLogged ? 'bg-slate-50 text-slate-400' : ''}`}
                      >
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={r.include && !r.alreadyLogged}
                            disabled={r.alreadyLogged}
                            onChange={(e) => updateRow(r.logDate, { include: e.target.checked })}
                          />
                        </td>
                        <td className="p-2 whitespace-nowrap">{r.logDate}</td>
                        <td className="p-2">
                          <input
                            className="input py-1 text-sm max-w-[5rem]"
                            disabled={r.alreadyLogged || !r.include}
                            value={r.hours}
                            onChange={(e) => updateRow(r.logDate, { hours: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            className="input py-1 text-sm max-w-[5rem]"
                            disabled={r.alreadyLogged || !r.include}
                            value={r.productiveHours}
                            onChange={(e) => updateRow(r.logDate, { productiveHours: e.target.value })}
                          />
                        </td>
                        <td className="p-2">
                          <input
                            className="input py-1 text-sm max-w-[5rem]"
                            disabled={r.alreadyLogged || !r.include}
                            value={r.qualityScore}
                            onChange={(e) => updateRow(r.logDate, { qualityScore: e.target.value })}
                          />
                        </td>
                        <td className="p-2 text-xs">
                          {r.alreadyLogged ? 'Already logged' : r.include ? 'Will save' : 'Skipped'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div>
                <label className="text-xs text-slate-500">Shared narrative (optional — applied to all saved days)</label>
                <textarea
                  className="input mt-1"
                  rows={2}
                  value={sharedNarrative}
                  onChange={(e) => setSharedNarrative(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" className="btn-primary text-sm" disabled={saving} onClick={saveMulti}>
                  {saving ? 'Saving…' : `Save ${includedRows.length} day${includedRows.length === 1 ? '' : 's'}`}
                </button>
                <span className="text-xs text-slate-500">
                  {includedRows.length} day{includedRows.length === 1 ? '' : 's'} · {multiTotalHours.toFixed(1)} h
                </span>
              </div>
            </>
          )}
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
                      <button
                        type="button"
                        className="text-teal text-xs hover:underline mr-2"
                        onClick={() => startEdit(log)}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="text-red-600 text-xs hover:underline"
                        onClick={() => remove(log.id)}
                      >
                        Delete
                      </button>
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
