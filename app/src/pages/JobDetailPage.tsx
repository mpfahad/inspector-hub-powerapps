import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type Client, type Department, type JobDetail } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { ActivityLogPanel } from '../components/activity/ActivityLogPanel';
import { AssignInspectorPanel } from '../components/jobs/AssignInspectorPanel';
import { JobEditPanel } from '../components/jobs/JobEditPanel';
import { JobProgressPanel } from '../components/jobs/JobProgressPanel';
import { currentAssignment, statusLabel } from '../lib/jobs';
import { JobCertBadges } from '../components/jobs/JobCertBadges';
import { formatMoney } from '../lib/money';

export function JobDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [completeComments, setCompleteComments] = useState('');
  const [completePrice, setCompletePrice] = useState('');
  const [actionError, setActionError] = useState('');

  const load = () =>
    api.job(Number(id)).then((j) => {
      setJob(j);
      setCompletePrice(j.agreedPriceUsd != null ? String(j.agreedPriceUsd) : '');
    });
  useEffect(() => { load(); }, [id]);

  useEffect(() => {
    if (user?.role === 'Inspector') return;
    Promise.all([api.clients(), api.departments()]).then(([c, d]) => {
      setClients(c);
      setDepartments(d);
    });
  }, [user?.role]);

  if (!job) return <p>Loading…</p>;

  const canAssign = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const isCoordinator = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const isInspector = user?.role === 'Inspector';
  const openAssignment = currentAssignment(job);
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

  const markComplete = async (inspectorId: number) => {
    setActionError('');
    try {
      await api.completeJob(
        job.id,
        inspectorId,
        completeComments,
        isCoordinator && Number.isFinite(parsedCompletePrice) ? parsedCompletePrice : undefined
      );
      await load();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not mark complete');
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/jobs" className="text-sm text-teal">← Jobs</Link>
      <div className="card p-6">
        <div className="flex justify-between items-start gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">{job.ref}</h1>
            <p className="text-slate-600 mt-1">{job.title}</p>
          </div>
          <span className="badge bg-teal/10 text-teal">{statusLabel(job.status)}</span>
        </div>
        <dl className="grid grid-cols-2 gap-4 mt-6 text-sm">
          <div><dt className="text-slate-500">Client</dt><dd className="font-medium">{job.client.name}</dd></div>
          <div><dt className="text-slate-500">Job type</dt><dd className="font-medium">{job.jobType?.name ?? '—'}</dd></div>
          <div><dt className="text-slate-500">Department</dt><dd className="font-medium">{job.department.name}</dd></div>
          <div><dt className="text-slate-500">Dates</dt><dd>{job.startDate.slice(0, 10)} — {job.endDate.slice(0, 10)}</dd></div>
          <div><dt className="text-slate-500">Priority</dt><dd>{job.priority}</dd></div>
          <div><dt className="text-slate-500">Estimated hours</dt><dd>{job.estimatedHours}h</dd></div>
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
            <dt className="text-slate-500">Current assignment</dt>
            <dd className="mt-1">
              {openAssignment ? (
                <div className="space-y-2">
                  <div className="font-medium">
                    <Link to={`/inspectors/${openAssignment.inspector.id}`} className="text-teal hover:underline">
                      {openAssignment.inspector.name}
                    </Link>
                    <span className="text-slate-500 font-normal">
                      {' '}
                      ({openAssignment.inspector.employeeNo}) — {openAssignment.role} ·{' '}
                    </span>
                    <span className="badge bg-slate-100">
                      {openAssignment.status === 'PendingAcceptance' ? 'Active' : openAssignment.status}
                    </span>
                    {openAssignment.inspector.qeApproved ? (
                      <span className="badge bg-teal/10 text-teal ml-2">QE approved</span>
                    ) : (
                      <span className="badge bg-slate-100 text-slate-500 ml-2">Not QE-approved</span>
                    )}
                  </div>
                  {job.requiresQeApproval && !openAssignment.inspector.qeApproved && (
                    <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      Note: a non–QE-approved inspector is assigned while this job prefers QE approval.
                    </p>
                  )}
                </div>
              ) : (
                <span className="text-slate-500">Unassigned</span>
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

      {job.progress && (
        <JobProgressPanel progress={job.progress} completedAt={job.completedAt} />
      )}

      {(job.status === 'Active' || job.status === 'PendingAcceptance' || job.status === 'Closed' || job.status === 'Completed') && (
        <ActivityLogPanel
          jobId={job.id}
          canLog={canLogActivity && (job.status === 'Active' || job.status === 'PendingAcceptance')}
          defaultInspectorId={logInspectorId}
          defaultFrom={job.startDate.slice(0, 10)}
          defaultTo={job.endDate.slice(0, 10)}
        />
      )}

      {(job.status === 'Active' || job.status === 'PendingAcceptance') && myAssignment && ['Accepted', 'Active', 'PendingAcceptance'].includes(myAssignment.status) && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Mark job complete</h2>
          <div>
            <label className="text-xs">Completion comments</label>
            <textarea className="input mt-1" rows={2} value={completeComments} onChange={(e) => setCompleteComments(e.target.value)} />
          </div>
          {isCoordinator && (
            <div>
              <label className="text-xs">Agreed price (QAR) — editable at complete</label>
              <input
                className="input mt-1 max-w-xs"
                type="number"
                min="0"
                value={completePrice}
                onChange={(e) => setCompletePrice(e.target.value)}
              />
            </div>
          )}
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <button type="button" className="btn-primary" onClick={() => markComplete(myAssignment.inspector.id)}>
            Mark complete
          </button>
        </div>
      )}

      {(job.status === 'Active' || job.status === 'PendingAcceptance') && isCoordinator && !isInspector && activeAssignments.length > 0 && (
        <div className="card p-6 space-y-4">
          <h2 className="font-semibold">Mark complete on behalf of inspector</h2>
          {actionError && <p className="text-sm text-red-600">{actionError}</p>}
          <div>
            <label className="text-xs">Completion comments</label>
            <textarea className="input mt-1" rows={2} value={completeComments} onChange={(e) => setCompleteComments(e.target.value)} />
          </div>
          <div>
            <label className="text-xs">Agreed price (QAR) — editable at complete</label>
            <input
              className="input mt-1 max-w-xs"
              type="number"
              min="0"
              value={completePrice}
              onChange={(e) => setCompletePrice(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            {activeAssignments.map((a) => (
              <button key={a.id} type="button" className="btn-primary text-sm" onClick={() => markComplete(a.inspector.id)}>
                Complete for {a.inspector.name}
              </button>
            ))}
          </div>
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

      {job.assignments.length > 0 && job.assignments.some((a) => ['Cancelled', 'Rejected'].includes(a.status)) && (
        <div className="card p-6">
          <h2 className="font-semibold mb-3 text-slate-500">Assignment history</h2>
          {job.assignments
            .filter((a) => ['Cancelled', 'Rejected'].includes(a.status))
            .map((a) => (
              <div key={a.id} className="text-sm py-2 border-b border-slate-100 last:border-0 text-slate-500">
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
              {' · '}{h.toStatus}
              {h.note ? ` — ${h.note}` : ''}
              {h.userEmail ? ` (${h.userEmail})` : ''}
            </div>
          ))
        )}
      </div>

      {canAssign && <AssignInspectorPanel job={job} onAssigned={load} />}
    </div>
  );
}
