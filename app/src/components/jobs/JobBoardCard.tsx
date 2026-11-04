import { Link } from 'react-router-dom';
import type { Job } from '../../lib/api';
import { assignmentLabel, stageForJob, statusLabel, JOB_STAGES, isUnassignedJob } from '../../lib/jobs';
import { progressFromJob } from '../../lib/jobProgress';
import { JobTimingBadge } from './JobProgressPanel';
import { JobCertBadges } from './JobCertBadges';

export function JobBoardCard({ job }: { job: Job }) {
  const stage = JOB_STAGES.find((s) => s.id === stageForJob(job));
  const assigned = assignmentLabel(job);
  const topProposal = job.proposals?.find((p) => !p.blocked);
  const progress = progressFromJob(job);
  const showTiming = job.status === 'Active' && (progress.timing === 'overdue' || progress.timing === 'in_progress');

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="block rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-teal/40 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-mono font-semibold text-teal">{job.ref}</span>
        <div className="flex flex-col items-end gap-1">
          <span className={`badge text-[10px] ${stage?.chip ?? 'bg-slate-100'}`}>
            {statusLabel(job.status)}
          </span>
          {showTiming && <JobTimingBadge timing={progress.timing} label={progress.label} />}
        </div>
      </div>
      <h3 className="font-semibold text-navy mt-2 leading-snug">{job.title}</h3>
      <p className="text-xs text-slate-500 mt-2">
        {job.client.name}
        {job.jobType && <span> · {job.jobType.name}</span>}
        {job.requiresQeApproval && <span className="text-amber-700"> · Prefers QE</span>}
      </p>
      <JobCertBadges summary={job.certSummary} compact />
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs">
        <span className="text-slate-400">
          {job.startDate.slice(0, 10)} — {job.endDate.slice(0, 10)}
        </span>
        {assigned ? (
          <span className="font-medium text-navy truncate max-w-[120px]" title={assigned}>
            {assigned}
          </span>
        ) : isUnassignedJob(job) && topProposal ? (
          <span className="text-slate-500">Suggested: {topProposal.inspector.name}</span>
        ) : null}
      </div>
    </Link>
  );
}

export function JobListRow({ job }: { job: Job }) {
  const stage = JOB_STAGES.find((s) => s.id === stageForJob(job));
  const assigned = assignmentLabel(job);

  return (
    <Link
      to={`/jobs/${job.id}`}
      className="grid grid-cols-[minmax(100px,1fr)_2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 text-sm"
    >
      <span className="font-mono text-xs font-semibold text-teal">{job.ref}</span>
      <div className="min-w-0">
        <div className="font-medium text-navy truncate">{job.title}</div>
        <div className="text-xs text-slate-500 truncate">{job.client.name}</div>
        <JobCertBadges summary={job.certSummary} compact />
      </div>
      <span className="text-slate-600 truncate">{job.jobType?.name ?? job.department.name}</span>
      <span className="text-slate-600 truncate">{assigned ?? '—'}</span>
      <span className="text-xs text-slate-400 whitespace-nowrap">
        {job.startDate.slice(0, 10)} — {job.endDate.slice(0, 10)}
      </span>
      <span className={`badge shrink-0 ${stage?.chip ?? 'bg-slate-100'}`}>
        {statusLabel(job.status)}
      </span>
    </Link>
  );
}
