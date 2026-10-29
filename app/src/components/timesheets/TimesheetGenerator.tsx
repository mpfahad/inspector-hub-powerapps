import { useEffect, useState } from 'react';
import { api, type Inspector, type Timesheet, type TimesheetPreview } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { TimesheetPreviewPanel } from './TimesheetPreviewPanel';

type Props = {
  compact?: boolean;
  showHistory?: boolean;
};

export function TimesheetGenerator({ compact, showHistory = true }: Props) {
  const { user } = useAuth();
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [history, setHistory] = useState<Timesheet[]>([]);
  const [inspectorId, setInspectorId] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [message, setMessage] = useState('');
  const [preview, setPreview] = useState<TimesheetPreview | null>(null);
  const [viewingId, setViewingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  const isStaff = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');

  useEffect(() => {
    api.timesheetDefaults().then((d) => {
      setPeriodStart(d.periodStart);
      setPeriodEnd(d.periodEnd);
    });
    if (showHistory) api.timesheets().then(setHistory);
    if (isStaff) api.inspectors().then(setInspectors);
  }, [isStaff, showHistory]);

  const params = () => ({
    inspectorId: inspectorId ? Number(inspectorId) : undefined,
    periodStart,
    periodEnd,
  });

  const downloadPdf = () => {
    window.open(api.timesheetReportPdfUrl(params()), '_blank');
  };

  const viewPreview = async () => {
    setMessage('');
    setViewingId(null);
    setBusy(true);
    try {
      const data = await api.previewTimesheet(params());
      setPreview(data);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Preview failed');
      setPreview(null);
    } finally {
      setBusy(false);
    }
  };

  const viewSaved = async (id: number) => {
    setMessage('');
    setPreview(null);
    setBusy(true);
    try {
      const data = await api.timesheet(id);
      setViewingId(id);
      setPreview({
        inspector: {
          name: data.inspector.name,
          employeeNo: data.inspector.employeeNo,
          department: data.inspector.department.name,
        },
        periodStart: data.periodStart,
        periodEnd: data.periodEnd,
        totalHours: data.totalHours,
        totalProductiveHours: data.totalProductiveHours,
        lines: data.lines.map((line) => {
          const desc = line.description ?? '';
          const jobRef = desc.split(':')[0]?.trim() || '—';
          const narrative = desc.includes(':') ? desc.slice(desc.indexOf(':') + 1).trim() : desc;
          return {
            logDate: line.logDate,
            jobRef,
            jobTitle: '',
            client: '',
            hours: line.hours,
            productiveHours: line.productiveHours,
            narrative,
          };
        }),
      });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not load timesheet');
    } finally {
      setBusy(false);
    }
  };

  const saveReport = async () => {
    setMessage('');
    try {
      const ts = await api.generateTimesheet(params());
      setMessage(`Saved report ${ts.ref}`);
      if (showHistory) api.timesheets().then(setHistory);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to generate');
    }
  };

  const closePreview = () => {
    setPreview(null);
    setViewingId(null);
  };

  return (
    <div className={compact ? 'space-y-4' : 'space-y-8'}>
      {!compact && (
        <div>
          <h1 className="text-2xl font-bold text-navy">Timesheet reports</h1>
          <p className="text-sm text-slate-500 mt-1">
            Generate activity timesheets for any period — default is the previous calendar month
          </p>
        </div>
      )}

      <div className="card p-6 space-y-4">
        {compact && (
          <div>
            <h2 className="font-semibold text-navy">Generate timesheet</h2>
            <p className="text-sm text-slate-500 mt-1">View, save, or download hours from your activity logs</p>
          </div>
        )}
        {isStaff && (
          <div>
            <label className="text-xs font-medium">Inspector</label>
            <select className="input mt-1" value={inspectorId} onChange={(e) => setInspectorId(e.target.value)}>
              <option value="">Select inspector…</option>
              {inspectors.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.employeeNo})
                </option>
              ))}
            </select>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Period start</label>
            <input
              type="date"
              className="input mt-1"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium">Period end</label>
            <input
              type="date"
              className="input mt-1"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              required
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary" disabled={busy} onClick={viewPreview}>
            View
          </button>
          <button type="button" className="btn-primary" onClick={downloadPdf}>
            Download PDF
          </button>
          <button type="button" className="btn-secondary" onClick={saveReport}>
            Save report
          </button>
        </div>
        {message && <p className="text-sm text-slate-600">{message}</p>}
        {preview && !viewingId && <TimesheetPreviewPanel data={preview} onClose={closePreview} />}
      </div>

      {showHistory && history.length > 0 && (
        <section>
          <h2 className="font-semibold text-navy mb-4">Recent reports</h2>
          <div className="space-y-3">
            {history.slice(0, compact ? 5 : undefined).map((ts) => (
              <div key={ts.id}>
                <div className="card p-4 flex justify-between items-center gap-4">
                  <div>
                    <div className="font-medium">{ts.ref}</div>
                    <div className="text-sm text-slate-500">
                      {ts.inspector.name} · {ts.periodStart.slice(0, 10)} — {ts.periodEnd.slice(0, 10)}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {ts.totalHours}h total · {ts.totalProductiveHours}h productive
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busy}
                      onClick={() => viewSaved(ts.id)}
                    >
                      View
                    </button>
                    <a
                      href={api.timesheetPdfUrl(ts.id)}
                      className="btn-primary text-xs"
                      target="_blank"
                      rel="noreferrer"
                    >
                      PDF
                    </a>
                  </div>
                </div>
                {viewingId === ts.id && preview && (
                  <TimesheetPreviewPanel data={preview} onClose={closePreview} />
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
