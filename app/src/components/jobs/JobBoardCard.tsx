import { Link } from 'react-router-dom';
import type { Job } from '../../lib/api';
import {
  assignmentLabel,
  crossDeptLabel,
  stageForJob,
  statusLabel,
  JOB_STAGES,
  isUnassignedJob,
  isCrossDeptAssignment,
  currentAssignment,
} from '../../lib/jobs';
import { progressFromJob } from '../../lib/jobProgress';
import { JobTimingBadge } from './JobProgressPanel';
import { JobCertBadges } from './JobCertBadges';
import { useOptionalDepartment } from '../../context/DepartmentContext';

function jobHref(job: Job, deptPath?: (suffix?: string) => string) {
  if (deptPath) return deptPath(`jobs/${job.id}`);
  return `/jobs/${job.id}`;
}

type CardProps = {
  job: Job;
  onAssign?: (job: Job) => void;
  onReassign?: (job: Job) => void;
};

export function JobBoardCard({ job, onAssign, onReassign }: CardProps) {
  const dept = useOptionalDepartment();
  const stage = JOB_STAGES.find((s) => s.id === stageForJob(job));
  const assigned = assignmentLabel(job);
  const cross = crossDeptLabel(job);
  const progress = progressFromJob(job);
  const showTiming = job.status === 'Active' && (progress.timing === 'overdue' || progress.timing === 'in_progress');
  const unassigned = isUnassignedJob(job);
  const openAsg = currentAssignment(job);
  const canManageTeam =
    !!openAsg && ['Proposed', 'PendingAcceptance', 'Active'].includes(job.status);

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-teal/40 hover:shadow-md transition-all">
      <Link to={jobHref(job, dept?.deptPath)} className="block">
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
      </Link>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 text-xs gap-2">
        <span className="text-slate-400 shrink-0">
          {job.startDate.slice(0, 10)} — {job.endDate.slice(0, 10)}
        </span>
        {assigned ? (
          <span
            className={`font-medium truncate max-w-[120px] text-right ${
              isCrossDeptAssignment(job) ? 'text-amber-800' : 'text-navy'
            }`}
            title={cross ? `${assigned} · ${cross}` : assigned}
          >
            {assigned}
            {cross && <span className="block text-[10px] font-normal text-amber-700">{cross}</span>}
          </span>
        ) : (
          <span className="text-slate-400">Unassigned</span>
        )}
      </div>

      {(unassigned && onAssign) || (canManageTeam && onReassign) ? (
        <div className="mt-3 flex justify-end">
          {unassigned && onAssign && (
            <button
              type="button"
              className="btn-primary text-xs px-3 py-1.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onAssign(job);
              }}
            >
              Assign team
            </button>
          )}
          {!unassigned && canManageTeam && onReassign && (
            <button
              type="button"
              className="btn-secondary text-xs px-3 py-1.5"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onReassign(job);
              }}
            >
              Manage team
            </button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function JobListRow({ job }: { job: Job }) {
  const dept = useOptionalDepartment();
  const stage = JOB_STAGES.find((s) => s.id === stageForJob(job));
  const assigned = assignmentLabel(job);
  const cross = crossDeptLabel(job);

  return (
    <Link
      to={jobHref(job, dept?.deptPath)}
      className="grid grid-cols-[minmax(100px,1fr)_2fr_1fr_1fr_1fr_auto] gap-4 items-center px-4 py-3 border-b border-slate-100 last:border-0 hover:bg-slate-50 text-sm"
    >
      <span className="font-mono text-xs font-semibold text-teal">{job.ref}</span>
      <div className="min-w-0">
        <div className="font-medium text-navy truncate">{job.title}</div>
        <div className="text-xs text-slate-500 truncate">{job.client.name}</div>
        <JobCertBadges summary={job.certSummary} compact />
      </div>
      <span className="text-slate-600 truncate">{job.jobType?.name ?? job.department.name}</span>
      <span className={`truncate ${isCrossDeptAssignment(job) ? 'text-amber-800' : 'text-slate-600'}`}>
        {assigned ?? '—'}
        {cross && <span className="block text-[10px] text-amber-700">{cross}</span>}
      </span>
      <span className="text-xs text-slate-400 whitespace-nowrap">
        {job.startDate.slice(0, 10)} — {job.endDate.slice(0, 10)}
      </span>
      <span className={`badge shrink-0 ${stage?.chip ?? 'bg-slate-100'}`}>
        {statusLabel(job.status)}
      </span>
    </Link>
  );
}
