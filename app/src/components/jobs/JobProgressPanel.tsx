import type { JobProgress, JobTiming } from '../../lib/jobProgress';
import { timingBadgeClass } from '../../lib/jobProgress';

export function JobTimingBadge({ timing, label }: { timing: JobTiming; label: string }) {
  return <span className={`badge shrink-0 ${timingBadgeClass(timing)}`}>{label}</span>;
}

type PanelProps = {
  progress: JobProgress;
  completedAt?: string | null;
};

export function JobProgressPanel({ progress, completedAt }: PanelProps) {
  const hoursPct =
    progress.allocatedHours > 0
      ? Math.min(100, Math.round((progress.loggedHours / progress.allocatedHours) * 100))
      : null;

  return (
    <div className="card p-6 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold text-navy">Schedule & completion</h2>
          <p className="text-sm text-slate-500 mt-1">{progress.detail}</p>
        </div>
        <JobTimingBadge timing={progress.timing} label={progress.label} />
      </div>

      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div>
          <dt className="text-slate-500">Planned window</dt>
          <dd className="font-medium">{progress.scheduledDays} day{progress.scheduledDays === 1 ? '' : 's'}</dd>
          <dd className="text-xs text-slate-400">{progress.scheduledStart} → {progress.scheduledEnd}</dd>
        </div>
        {progress.isComplete ? (
          <div>
            <dt className="text-slate-500">Completed</dt>
            <dd className="font-medium">
              {completedAt ? new Date(completedAt).toLocaleDateString() : '—'}
            </dd>
            {progress.daysEarly > 0 && (
              <dd className="text-xs text-teal">{progress.daysEarly} day{progress.daysEarly === 1 ? '' : 's'} early</dd>
            )}
            {progress.daysOverdue > 0 && (
              <dd className="text-xs text-red-600">{progress.daysOverdue} day{progress.daysOverdue === 1 ? '' : 's'} late</dd>
            )}
          </div>
        ) : progress.timing === 'overdue' ? (
          <div>
            <dt className="text-slate-500">Overdue by</dt>
            <dd className="font-medium text-red-600">{progress.daysOverdue} day{progress.daysOverdue === 1 ? '' : 's'}</dd>
          </div>
        ) : progress.timing === 'in_progress' ? (
          <div>
            <dt className="text-slate-500">Days remaining</dt>
            <dd className="font-medium">{progress.daysRemaining}</dd>
          </div>
        ) : (
          <div>
            <dt className="text-slate-500">Status</dt>
            <dd className="font-medium">Not started</dd>
          </div>
        )}
        <div>
          <dt className="text-slate-500">Hours logged</dt>
          <dd className="font-medium">{progress.loggedHours}h</dd>
          {progress.allocatedHours > 0 && (
            <dd className="text-xs text-slate-400">of {progress.allocatedHours}h allocated</dd>
          )}
        </div>
        <div>
          <dt className="text-slate-500">Work days logged</dt>
          <dd className="font-medium">{progress.workDaysLogged}</dd>
        </div>
      </dl>

      {hoursPct !== null && progress.timing !== 'scheduled' && (
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>Hours vs allocation</span>
            <span>{hoursPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
            <div
              className={`h-full rounded-full ${hoursPct > 100 ? 'bg-amber-500' : 'bg-teal'}`}
              style={{ width: `${Math.min(100, hoursPct)}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
