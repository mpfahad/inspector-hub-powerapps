import { Link } from 'react-router-dom';
import { type Assignment } from '../../lib/api';
import { progressFromJob } from '../../lib/jobProgress';
import { JobTimingBadge } from '../jobs/JobProgressPanel';

export function ActiveAssignmentCard({ assignment }: { assignment: Assignment }) {
  const progress = progressFromJob({
    ...assignment.job,
    allocatedHours: assignment.allocatedHours,
  });

  return (
    <Link
      to={`/jobs/${assignment.job.id}`}
      className="card block p-5 hover:border-teal/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-navy">{assignment.job.ref} — {assignment.job.title}</div>
          <div className="text-sm text-slate-500 mt-1">
            {assignment.job.client.name} · {assignment.role} · {assignment.allocatedHours}h allocated
          </div>
          <p className="text-xs text-slate-400 mt-1">{progress.detail}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="badge bg-teal/10 text-teal">Active</span>
          {(progress.timing === 'overdue' || progress.timing === 'in_progress') && (
            <JobTimingBadge timing={progress.timing} label={progress.label} />
          )}
        </div>
      </div>
      <p className="text-xs text-teal mt-3">Open job → log activity & mark finished</p>
    </Link>
  );
}

function jobCompletionLabel(jobStatus: string) {
  if (jobStatus === 'Completed' || jobStatus === 'Closed') return { text: 'Successfully completed', className: 'bg-teal/10 text-teal' };
  return { text: jobStatus, className: 'bg-slate-100 text-slate-700' };
}

export function CompletedAssignmentCard({ assignment, compact }: { assignment: Assignment; compact?: boolean }) {
  const badge = jobCompletionLabel(assignment.job.status);
  const progress = progressFromJob({
    ...assignment.job,
    allocatedHours: assignment.allocatedHours,
  });
  const completedAt = assignment.job.completedAt
    ? new Date(assignment.job.completedAt).toLocaleDateString()
    : null;
  const showTiming = ['completed_early', 'completed_on_time', 'completed_late'].includes(progress.timing);

  if (compact) {
    return (
      <Link
        to={`/jobs/${assignment.job.id}`}
        className="flex items-center justify-between gap-3 py-3 px-4 border-b border-slate-100 last:border-0 hover:bg-slate-50"
      >
        <div className="min-w-0">
          <div className="font-medium text-navy truncate">{assignment.job.ref} — {assignment.job.title}</div>
          <div className="text-xs text-slate-500">
            {assignment.job.client.name}
            {completedAt ? ` · ${completedAt}` : ''}
            {showTiming ? ` · ${progress.label}` : ''}
          </div>
        </div>
        <span className={`badge shrink-0 ${badge.className}`}>{badge.text}</span>
      </Link>
    );
  }

  return (
    <Link
      to={`/jobs/${assignment.job.id}`}
      className="card block p-5 hover:border-teal/50 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-navy">{assignment.job.ref} — {assignment.job.title}</div>
          <div className="text-sm text-slate-500 mt-1">
            {assignment.job.client.name} · {assignment.role}
            {completedAt && ` · Completed ${completedAt}`}
          </div>
          {showTiming && <p className="text-xs text-slate-400 mt-1">{progress.detail}</p>}
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className={`badge ${badge.className}`}>{badge.text}</span>
          {showTiming && <JobTimingBadge timing={progress.timing} label={progress.label} />}
        </div>
      </div>
    </Link>
  );
}
