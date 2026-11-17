import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Client,
  type CompleteJobMemberPayload,
  type Department,
  type JobDetail,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ActivityLogPanel } from '../components/activity/ActivityLogPanel';
import { AssignInspectorModal } from '../components/jobs/AssignInspectorModal';
import { CancelJobModal } from '../components/jobs/CancelJobModal';
import { JobEditPanel } from '../components/jobs/JobEditPanel';
import { JobProgressPanel } from '../components/jobs/JobProgressPanel';
import {
  crossDeptLabel,
  currentAssignment,
  isCrossDeptAssignment,
  openAssignments,
  requiredTeamSize,
  statusLabel,
} from '../lib/jobs';
import { JobCertBadges } from '../components/jobs/JobCertBadges';
import { formatMoney } from '../lib/money';
import { useOptionalDepartment } from '../context/DepartmentContext';

const CANCELABLE = ['Draft', 'Proposed', 'PendingAcceptance', 'Active'];

type MemberEdit = {
  assignmentId: number;
  dailyCostUsd: string;
  dailyBillableUsd: string;
};

export function JobDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const deptCtx = useOptionalDepartment();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [completeComments, setCompleteComments] = useState('');
  const [completePrice, setCompletePrice] = useState('');
  const [memberEdits, setMemberEdits] = useState<MemberEdit[]>([]);
  const [actionError, setActionError] = useState('');
  const [assignOpen, setAssignOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [savingToggles, setSavingToggles] = useState(false);

  const jobId = Number(id);
  const idValid = Number.isFinite(jobId) && jobId > 0;
  const [loadError, setLoadError] = useState('');

  const syncMemberEdits = (j: JobDetail) => {
    const open = j.assignments.filter((a) =>
      ['Accepted', 'Active', 'PendingAcceptance'].includes(a.status)
    );
    setMemberEdits(
      open.map((a) => ({
        assignmentId: a.id,
        dailyCostUsd: a.dailyCostUsd != null ? String(a.dailyCostUsd) : '',
        dailyBillableUsd: a.dailyBillableUsd != null ? String(a.dailyBillableUsd) : '',
      }))
    );
  };

  const load = () => {
    if (!idValid) return Promise.resolve();
    setLoadError('');
    return api
      .job(jobId)
      .then((j) => {
        setJob(j);
        setCompletePrice(j.agreedPriceUsd != null ? String(j.agreedPriceUsd) : '');
        syncMemberEdits(j);
      })
      .catch((err) => {
        setJob(null);
        setLoadError(err instanceof Error ? err.message : 'Could not load job');
      });
  };
  useEffect(() => {
    setJob(null);
    load();
  }, [id]);

  useEffect(() => {
    if (user?.role === 'Inspector') return;
    Promise.all([api.clients(), api.departments()]).then(([c, d]) => {
      setClients(c);
      setDepartments(d);
    });
  }, [user?.role]);

  const jobsListPath = deptCtx?.deptPath('jobs') ?? '/jobs';

  if (!idValid) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">Invalid job link.</p>
        <Link to={jobsListPath} className="text-sm text-teal">
          ← Back to jobs
        </Link>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-red-600">{loadError}</p>
        <Link to={jobsListPath} className="text-sm text-teal">
          ← Back to jobs
        </Link>
      </div>
    );
  }

  if (!job) return <p>Loading…</p>;

  const canAssign = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const isCoordinator = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const isInspector = user?.role === 'Inspector';
  const openAssignment = currentAssignment(job);
  const team = openAssignments(job);
  const need = requiredTeamSize(job);
  const myAssignment = job.assignments.find((a) =>
    user?.inspectorId != null ? a.inspector.id === user.inspectorId : a.inspector.email === user?.email
  );
  const activeAssignments = job.assignments.filter((a) =>
    ['Accepted', 'Active', 'PendingAcceptance'].includes(a.status)
  );
  const canLogActivity =
    (isInspector && myAssignment && ['Accepted', 'Active'].includes(myAssignment.status)) ||
    isCoordinator;
  const logInspectorId = myAssignment?.inspector.id ?? activeAssignments[0]?.inspector.id;

  const parsedCompletePrice = completePrice.trim() === '' ? undefined : Number(completePrice);

  const memberPayload = (): CompleteJobMemberPayload[] | undefined => {
    if (!isCoordinator || memberEdits.length === 0) return undefined;
    return memberEdits.map((m) => ({
      assignmentId: m.assignmentId,
      dailyCostUsd: m.dailyCostUsd.trim() === '' ? null : Number(m.dailyCostUsd),
      dailyBillableUsd: m.dailyBillableUsd.trim() === '' ? null : Number(m.dailyBillableUsd),
    }));
  };

  const markComplete = async (inspectorId: number) => {
    setActionError('');
    try {
      await api.completeJob(
        job.id,
        inspectorId,
        completeComments,
        isCoordinator && Number.isFinite(parsedCompletePrice) ? parsedCompletePrice : undefined,
        memberPayload()
      );
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark complete');
    }
  };

  const updateMemberEdit = (assignmentId: number, patch: Partial<MemberEdit>) => {
    setMemberEdits((rows) =>
      rows.map((r) => (r.assignmentId === assignmentId ? { ...r, ...patch } : r))
    );
  };

  const cross = job ? crossDeptLabel(job) : null;
  const cancelNote = job.statusHistory.find((h) => h.toStatus === 'Cancelled')?.note;

  return (
    <div className="max-w-4xl space-y-6">
      <Link to={jobsListPath} className="text-sm text-teal">
        ← Jobs
      </Link>
      <div className="card p-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">{job.ref}</h1>
            <p className="text-slate-600 mt-1">{job.title}</p>
          </div>
          <div className="flex flex-wrap gap-2 justify-end">
            <span
              className={`badge ${
                job.status === 'Cancelled' ? 'bg-slate-200 text-slate-700' : 'bg-teal/10 text-teal'
              }`}
            >
              {statusLabel(job.status)}
            </span>
            {job.autoCompleteOnEndDate !== false && (
              <span className="badge bg-slate-100 text-slate-600" title="Closes when end date passes">
                Auto-complete
              </span>
            )}
            {job.autoCompleteOnEndDate === false && (
              <span className="badge bg-amber-100 text-amber-800">Manual complete</span>
            )}
            <span className="badge bg-slate-100 text-slate-600">
              {job.rateBasis === 'hourly' ? 'Hourly rate' : 'Day rate'}
            </span>
          </div>
        </div>
        {user?.role !== 'Inspector' &&
          ['Draft', 'Proposed', 'PendingAcceptance', 'Active'].includes(job.status) && (
            <div className="mt-4 flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-2">
                <span className="text-slate-500">Completion</span>
                <select
                  className="input py-1 text-sm"
                  disabled={savingToggles}
                  value={job.autoCompleteOnEndDate === false ? 'manual' : 'auto'}
                  onChange={async (e) => {
                    setSavingToggles(true);
                    setActionError('');
                    try {
                      const updated = await api.updateJob(job.id, {
                        autoCompleteOnEndDate: e.target.value === 'auto',
                      });
                      setJob(updated);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'Could not update');
                    } finally {
                      setSavingToggles(false);
                    }
                  }}
                >
                  <option value="auto">Auto-complete on end date</option>
                  <option value="manual">Manual complete</option>
                </select>
              </label>
              <label className="flex items-center gap-2">
                <span className="text-slate-500">Rate</span>
                <select
                  className="input py-1 text-sm"
                  disabled={savingToggles}
                  value={job.rateBasis === 'hourly' ? 'hourly' : 'day'}
                  onChange={async (e) => {
                    setSavingToggles(true);
                    setActionError('');
                    try {
                      const updated = await api.updateJob(job.id, {
                        rateBasis: e.target.value === 'hourly' ? 'hourly' : 'day',
                      });
                      setJob(updated);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : 'Could not update');
                    } finally {
                      setSavingToggles(false);
                    }
                  }}
                >
                  <option value="day">Day rate</option>
                  <option value="hourly">Hourly rate</option>
                </select>
              </label>
            </div>
          )}
        {job.status === 'Cancelled' && (
          <p className="mt-4 text-sm text-slate-700 bg-slate-100 border border-slate-200 rounded-lg px-3 py-2">
            This job is cancelled and no longer appears on the board or map.
            {cancelNote ? ` Reason: ${cancelNote}` : ''}
          </p>
        )}
        <dl className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div>
            <dt className="text-slate-500">Client</dt>
            <dd className="font-medium">{job.client.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Job type</dt>
            <dd className="font-medium">{job.jobType?.name ?? '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Department</dt>
            <dd className="font-medium">{job.department.name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Dates</dt>
            <dd>
              {job.startDate.slice(0, 10)} — {job.endDate.slice(0, 10)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Priority</dt>
            <dd>{job.priority}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Estimated hours</dt>
            <dd>{job.estimatedHours}h</dd>
          </div>
          <div>
            <dt className="text-slate-500">Team size</dt>
            <dd className="font-medium">
              {team.length}/{need} inspectors
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Agreed price (QAR)</dt>
            <dd className="font-medium">
              {job.agreedPriceUsd != null
                ? formatMoney(job.agreedPriceUsd)
                : job.suggestedPriceUsd != null
                  ? `Default ${formatMoney(job.suggestedPriceUsd)}`
                  : '—'}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">QE-approved inspector</dt>
            <dd className="font-medium">
              {job.requiresQeApproval ? 'Preferred for this job' : 'Not required'}
            </dd>
          </div>
          <div className="col-span-2">
            <dt className="text-slate-500">Team</dt>
            <dd className="mt-1">
              {team.length === 0 ? (
                <span className="text-slate-500">Unassigned</span>
              ) : (
                <ul className="space-y-2">
                  {team.map((a) => {
                    const start = (a.mobDate ?? job.startDate).slice(0, 10);
                    const end = (a.demobDate ?? job.endDate).slice(0, 10);
                    return (
                      <li key={a.id} className="font-medium">
                        <Link to={`/inspectors/${a.inspector.id}`} className="text-teal hover:underline">
                          {a.inspector.name}
                        </Link>
                        <span className="text-slate-500 font-normal">
                          {' '}
                          ({a.inspector.employeeNo}) — {a.role} · {start} – {end}
                          {a.dailyBillableUsd != null ? ` · ${formatMoney(a.dailyBillableUsd)}/day` : ''}
                          {' · '}
                        </span>
                        <span className="badge bg-slate-100">
                          {a.status === 'PendingAcceptance' ? 'Active' : a.status}
                        </span>
                        {a.inspector.qeApproved ? (
                          <span className="badge bg-teal/10 text-teal ml-2">QE approved</span>
                        ) : (
                          <span className="badge bg-slate-100 text-slate-500 ml-2">Not QE-approved</span>
                        )}
                        {a.inspector.department &&
                          a.inspector.department.id !== job.department.id && (
                            <span className="badge bg-amber-100 text-amber-900 ml-2">
                              Borrowed from {a.inspector.department.name}
                            </span>
                          )}
                      </li>
                    );
                  })}
                </ul>
              )}
              {isCrossDeptAssignment(job) && (
                <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2">
                  Cross-department assignment(s) on this job. Utilization counts on each inspector’s home
                  department. {cross}
                </p>
              )}
            </dd>
          </div>
        </dl>
        <div className="mt-4">
          <dt className="text-xs text-slate-500 mb-2">Required certifications</dt>
          <JobCertBadges summary={job.certSummary} />
        </div>
        {job.scope && <p className="mt-4 text-sm text-slate-600">{job.scope}</p>}
        {canAssign && clients.length > 0 && (
          <div className="mt-4">
            <JobEditPanel job={job} clients={clients} departments={departments} onSaved={load} />
          </div>
        )}
      </div>

      {job.progress && <JobProgressPanel progress={job.progress} completedAt={job.completedAt} />}

      {(job.status === 'Active' ||
        job.status === 'PendingAcceptance' ||
        job.status === 'Closed' ||
        job.status === 'Completed') && (
        <ActivityLogPanel
          jobId={job.id}
          canLog={canLogActivity && (job.status === 'Active' || job.status === 'PendingAcceptance')}
          defaultInspectorId={logInspectorId}
          defaultFrom={job.startDate.slice(0, 10)}
          defaultTo={job.endDate.slice(0, 10)}
        />
      )}

      {(job.status === 'Active' || job.status === 'PendingAcceptance') &&
        myAssignment &&
        ['Accepted', 'Active', 'PendingAcceptance'].includes(myAssignment.status) &&
        !isCoordinator && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold">Mark job complete</h2>
            <div>
              <label className="text-xs">Completion comments</label>
              <textarea
                className="input mt-1"
                rows={2}
                value={completeComments}
                onChange={(e) => setCompleteComments(e.target.value)}
              />
            </div>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <button
              type="button"
              className="btn-primary"
              onClick={() => markComplete(myAssignment.inspector.id)}
            >
              Mark complete
            </button>
          </div>
        )}

      {(job.status === 'Active' || job.status === 'PendingAcceptance') &&
        isCoordinator &&
        activeAssignments.length > 0 && (
          <div className="card p-6 space-y-4">
            <h2 className="font-semibold">Mark job complete</h2>
            {actionError && <p className="text-sm text-red-600">{actionError}</p>}
            <div>
              <label className="text-xs">Completion comments</label>
              <textarea
                className="input mt-1"
                rows={2}
                value={completeComments}
                onChange={(e) => setCompleteComments(e.target.value)}
              />
            </div>
            <div>
              <label className="text-xs">Agreed job price (QAR)</label>
              <input
                className="input mt-1 max-w-xs"
                type="number"
                min="0"
                value={completePrice}
                onChange={(e) => setCompletePrice(e.target.value)}
              />
            </div>
            <div className="space-y-3">
              <p className="text-xs font-medium text-slate-500">Inspector rates (editable at complete)</p>
              {activeAssignments.map((a) => {
                const edit = memberEdits.find((m) => m.assignmentId === a.id);
                return (
                  <div
                    key={a.id}
                    className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 sm:grid-cols-3 gap-3 items-end"
                  >
                    <div>
                      <div className="text-sm font-medium text-navy">{a.inspector.name}</div>
                      <div className="text-xs text-slate-500">{a.role}</div>
                    </div>
                    <div>
                      <label className="text-xs">Daily cost (QAR)</label>
                      <input
                        className="input mt-1"
                        type="number"
                        min="0"
                        value={edit?.dailyCostUsd ?? ''}
                        onChange={(e) =>
                          updateMemberEdit(a.id, { dailyCostUsd: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs">Daily billable (QAR)</label>
                      <input
                        className="input mt-1"
                        type="number"
                        min="0"
                        value={edit?.dailyBillableUsd ?? ''}
                        onChange={(e) =>
                          updateMemberEdit(a.id, { dailyBillableUsd: e.target.value })
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="btn-primary"
              onClick={() => markComplete(activeAssignments[0].inspector.id)}
            >
              Mark complete (closes whole team)
            </button>
          </div>
        )}

      {(job.status === 'Closed' || job.status === 'Completed') && (
        <div className="card p-6 space-y-2 border-teal/30 bg-teal/5">
          <h2 className="font-semibold text-teal">Successfully completed</h2>
          {job.completedByEmail && (
            <p className="text-sm text-slate-600">
              Completed by {job.completedByEmail}
              {job.completedAt ? ` on ${new Date(job.completedAt).toLocaleString()}` : ''}
            </p>
          )}
          {job.closingComments && <p className="text-sm text-slate-500">{job.closingComments}</p>}
          {job.agreedPriceUsd != null && (
            <p className="text-sm text-slate-600">Agreed price: {formatMoney(job.agreedPriceUsd)}</p>
          )}
        </div>
      )}

      {job.assignments.length > 0 &&
        job.assignments.some((a) => ['Cancelled', 'Rejected'].includes(a.status)) && (
          <div className="card p-6">
            <h2 className="font-semibold mb-3 text-slate-500">Assignment history</h2>
            {job.assignments
              .filter((a) => ['Cancelled', 'Rejected'].includes(a.status))
              .map((a) => (
                <div
                  key={a.id}
                  className="text-sm py-2 border-b border-slate-100 last:border-0 text-slate-500"
                >
                  {a.inspector.name} — {a.status}
                  {a.rejectReason ? `: ${a.rejectReason}` : ''}
                </div>
              ))}
          </div>
        )}

      <div className="card p-6">
        <h2 className="font-semibold mb-3">Status history</h2>
        {job.statusHistory.length === 0 ? (
          <p className="text-sm text-slate-500">No status changes recorded.</p>
        ) : (
          job.statusHistory.map((h, i) => (
            <div key={i} className="text-xs text-slate-600 py-1 border-b border-slate-50 last:border-0">
              <span className="font-medium">{new Date(h.createdAt).toLocaleString()}</span>
              {' · '}
              {h.toStatus}
              {h.note ? ` — ${h.note}` : ''}
              {h.userEmail ? ` (${h.userEmail})` : ''}
            </div>
          ))
        )}
      </div>

      {canAssign &&
        (['Draft', 'Proposed', 'PendingAcceptance', 'Active'].includes(job.status) ||
          openAssignment) && (
          <div className="card p-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-navy">
                {team.length === 0 ? 'No inspectors assigned' : `Team ${team.length}/${need}`}
              </h2>
              <p className="text-sm text-slate-500 mt-1">
                Add or remove inspectors on this job. Job dates apply to the whole team.
              </p>
            </div>
            <button type="button" className="btn-primary" onClick={() => setAssignOpen(true)}>
              {team.length === 0 ? 'Assign team' : 'Manage team'}
            </button>
          </div>
        )}

      {canAssign && CANCELABLE.includes(job.status) && (
        <div className="card p-6 flex flex-wrap items-center justify-between gap-3 border-slate-200">
          <div>
            <h2 className="font-semibold text-navy">Cancel job</h2>
            <p className="text-sm text-slate-500 mt-1">
              Soft-cancel with a required note. The job leaves the board; history is kept.
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary text-red-700 border-red-200 hover:bg-red-50"
            onClick={() => setCancelOpen(true)}
          >
            Cancel job
          </button>
        </div>
      )}

      {canAssign && (
        <AssignInspectorModal
          job={job}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
          onAssigned={() => {
            load();
          }}
        />
      )}

      {canAssign && (
        <CancelJobModal
          job={job}
          open={cancelOpen}
          onClose={() => setCancelOpen(false)}
          onCancelled={() => {
            setCancelOpen(false);
            load();
          }}
        />
      )}
    </div>
  );
}
