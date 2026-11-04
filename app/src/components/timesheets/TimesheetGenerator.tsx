import { useEffect, useMemo, useState } from 'react';
import {
  api,
  type Department,
  type Inspector,
  type Job,
  type JobType,
  type Timesheet,
  type TimesheetPreview,
} from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { TimesheetPreviewPanel } from './TimesheetPreviewPanel';

type Props = {
  compact?: boolean;
  showHistory?: boolean;
};

export function TimesheetGenerator({ compact, showHistory = true }: Props) {
  const { user } = useAuth();
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [history, setHistory] = useState<Timesheet[]>([]);
  const [inspectorId, setInspectorId] = useState('');
  const [deptFilter, setDeptFilter] = useState('');
  const [jobTypeFilter, setJobTypeFilter] = useState('');
  const [inspectorSearch, setInspectorSearch] = useState('');
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
    if (isStaff) {
      Promise.all([api.inspectors(), api.departments(), api.jobTypes(), api.jobs()]).then(
        ([ins, depts, types, jobList]) => {
          setInspectors(ins);
          setDepartments(depts);
          setJobTypes(types);
          setJobs(jobList);
        }
      );
    }
  }, [isStaff, showHistory]);

  const jobTypeScope = useMemo(() => {
    const inspectorIds = new Map<number, Set<number>>();
    const departmentIds = new Map<number, Set<number>>();
    for (const job of jobs) {
      const typeId = job.jobType?.id;
      if (typeId == null) continue;
      let iSet = inspectorIds.get(typeId);
      if (!iSet) {
        iSet = new Set();
        inspectorIds.set(typeId, iSet);
      }
      let dSet = departmentIds.get(typeId);
      if (!dSet) {
        dSet = new Set();
        departmentIds.set(typeId, dSet);
      }
      dSet.add(job.department.id);
      for (const a of job.assignments ?? []) {
        if (a.inspector?.id) iSet.add(a.inspector.id);
      }
    }
    return { inspectorIds, departmentIds };
  }, [jobs]);

  const filteredInspectors = useMemo(() => {
    const q = inspectorSearch.trim().toLowerCase();
    const typeId = jobTypeFilter ? Number(jobTypeFilter) : null;
    const typeInspectors = typeId != null ? jobTypeScope.inspectorIds.get(typeId) : null;
    const typeDepts = typeId != null ? jobTypeScope.departmentIds.get(typeId) : null;

    return inspectors
      .filter((i) => {
        if (deptFilter && String(i.department.id) !== deptFilter) return false;
        if (typeId != null) {
          const onJobs = typeInspectors?.has(i.id);
          const inDept = typeDepts?.has(i.department.id);
          if (!onJobs && !inDept) return false;
        }
        if (q) {
          const hay = [i.name, i.employeeNo, i.jobTitle ?? '', i.department.name].join(' ').toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [inspectors, deptFilter, jobTypeFilter, inspectorSearch, jobTypeScope]);

  useEffect(() => {
    if (!inspectorId) return;
    if (!filteredInspectors.some((i) => String(i.id) === inspectorId)) {
      setInspectorId('');
    }
  }, [filteredInspectors, inspectorId]);

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

  const filtersActive = Boolean(deptFilter || jobTypeFilter || inspectorSearch.trim());

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
          <div className="space-y-3">
            <div className="grid sm:grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-medium text-slate-500">Department</label>
                <select
                  className="input mt-1"
                  value={deptFilter}
                  onChange={(e) => setDeptFilter(e.target.value)}
                >
                  <option value="">All departments</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Job type</label>
                <select
                  className="input mt-1"
                  value={jobTypeFilter}
                  onChange={(e) => setJobTypeFilter(e.target.value)}
                >
                  <option value="">All job types</option>
                  {jobTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Search inspectors</label>
                <input
                  type="search"
                  className="input mt-1"
                  placeholder="Name, employee no, title…"
                  value={inspectorSearch}
                  onChange={(e) => setInspectorSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between gap-2">
                <label className="text-xs font-medium text-slate-500">Inspector</label>
                <span className="text-xs text-slate-400">
                  {filteredInspectors.length} of {inspectors.length}
                  {filtersActive && (
                    <>
                      {' · '}
                      <button
                        type="button"
                        className="text-teal hover:underline"
                        onClick={() => {
                          setDeptFilter('');
                          setJobTypeFilter('');
                          setInspectorSearch('');
                        }}
                      >
                        Clear filters
                      </button>
                    </>
                  )}
                </span>
              </div>
              <select
                className="input mt-1"
                value={inspectorId}
                onChange={(e) => setInspectorId(e.target.value)}
              >
                <option value="">Select inspector…</option>
                {filteredInspectors.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.employeeNo}) — {i.department.name}
                    {i.jobTitle ? ` · ${i.jobTitle}` : ''}
                  </option>
                ))}
              </select>
              {jobTypeFilter && filteredInspectors.length === 0 && (
                <p className="text-xs text-amber-800 mt-1">
                  No inspectors found on jobs of this type. Clear the job type filter or pick another department.
                </p>
              )}
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-slate-500">Period start</label>
            <input
              type="date"
              className="input mt-1"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-500">Period end</label>
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
