import type { Job } from '../lib/api';

export const JOB_STAGES = [
  {
    id: 'new',
    label: 'New',
    description: 'No inspector assigned yet',
    accent: 'border-blue-500',
    chip: 'bg-blue-50 text-blue-700',
    statuses: ['Draft', 'Proposed'],
  },
  {
    id: 'active',
    label: 'Active',
    description: 'Assigned — work in progress',
    accent: 'border-emerald-500',
    chip: 'bg-emerald-50 text-emerald-800',
    statuses: ['Active', 'PendingAcceptance'],
  },
  {
    id: 'completed',
    label: 'Completed',
    description: 'Successfully closed',
    accent: 'border-slate-300',
    chip: 'bg-slate-100 text-slate-500',
    statuses: ['Closed', 'Completed'],
  },
] as const;

export type JobStageId = (typeof JOB_STAGES)[number]['id'] | 'all';

const OPEN_ASSIGNMENT_STATUSES = ['PendingAcceptance', 'Accepted', 'Active', 'Proposed'];

export function openAssignments(job: Job) {
  return (job.assignments ?? []).filter((a) => OPEN_ASSIGNMENT_STATUSES.includes(a.status));
}

export function currentAssignment(job: Job) {
  return openAssignments(job)[0];
}

export function requiredTeamSize(job: Job): number {
  return job.requiredInspectorCount && job.requiredInspectorCount > 0 ? job.requiredInspectorCount : 1;
}

export function teamFillLabel(job: Job): string | null {
  const open = openAssignments(job);
  if (open.length === 0) return null;
  const need = requiredTeamSize(job);
  if (open.length === 1 && need <= 1) return open[0].inspector.name;
  const names = open.map((a) => a.inspector.name).join(', ');
  return `${open.length}/${need}: ${names}`;
}

export function assignmentLabel(job: Job): string | null {
  return teamFillLabel(job);
}

/** Assignee belongs to a different department than the job (CM-018 cross-dept loan). */
export function isCrossDeptAssignment(job: Job): boolean {
  return openAssignments(job).some(
    (a) => a.inspector?.department && a.inspector.department.id !== job.department.id
  );
}

export function crossDeptLabel(job: Job): string | null {
  const loans = openAssignments(job).filter(
    (a) => a.inspector?.department && a.inspector.department.id !== job.department.id
  );
  if (loans.length === 0) return null;
  if (loans.length === 1) {
    return `Borrowed from ${loans[0].inspector.department.name}`;
  }
  return `${loans.length} borrowed from other depts`;
}

export function hasOpenAssignment(job: Job): boolean {
  return openAssignments(job).length > 0;
}

export function isUnassignedJob(job: Job): boolean {
  return !hasOpenAssignment(job) && !['Active', 'Completed', 'Closed', 'Cancelled', 'PendingAcceptance'].includes(job.status);
}

export function stageForJob(job: Job): JobStageId {
  if (job.status === 'Closed' || job.status === 'Completed') return 'completed';
  if (job.status === 'Active' || job.status === 'PendingAcceptance') return 'active';
  if (isUnassignedJob(job)) return 'new';
  return 'new';
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    Draft: 'Draft',
    Proposed: 'Proposed',
    PendingAcceptance: 'Active',
    Active: 'Active',
    Completed: 'Completed',
    Closed: 'Completed',
    Cancelled: 'Cancelled',
  };
  return map[status] ?? status;
}

export function matchesSearch(job: Job, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const inspector = currentAssignment(job)?.inspector.name.toLowerCase() ?? '';
  return (
    job.ref.toLowerCase().includes(q) ||
    job.title.toLowerCase().includes(q) ||
    job.client.name.toLowerCase().includes(q) ||
    (job.jobType?.name.toLowerCase().includes(q) ?? false) ||
    inspector.includes(q)
  );
}
