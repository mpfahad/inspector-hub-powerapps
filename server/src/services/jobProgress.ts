export type JobTiming =
  | 'scheduled'
  | 'in_progress'
  | 'overdue'
  | 'completed_early'
  | 'completed_on_time'
  | 'completed_late';

export type JobProgressInput = {
  startDate: string | Date;
  endDate: string | Date;
  status: string;
  completedAt?: string | Date | null;
  estimatedHours?: number;
  allocatedHours?: number;
  loggedHours?: number;
  workDaysLogged?: number;
  asOf?: Date;
};

export type JobProgress = {
  scheduledDays: number;
  scheduledStart: string;
  scheduledEnd: string;
  loggedHours: number;
  allocatedHours: number;
  workDaysLogged: number;
  daysRemaining: number;
  daysOverdue: number;
  daysEarly: number;
  timing: JobTiming;
  label: string;
  detail: string;
  isComplete: boolean;
};

function toDateOnly(value: string | Date) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string) {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function scheduledDays(startDate: string | Date, endDate: string | Date) {
  const start = toDateOnly(startDate);
  const end = toDateOnly(endDate);
  return Math.max(1, dayDiff(start, end) + 1);
}

export function computeJobProgress(input: JobProgressInput): JobProgress {
  const start = toDateOnly(input.startDate);
  const end = toDateOnly(input.endDate);
  const today = toDateOnly(input.asOf ?? new Date());
  const days = scheduledDays(start, end);
  const loggedHours = input.loggedHours ?? 0;
  const allocatedHours = input.allocatedHours ?? input.estimatedHours ?? 0;
  const workDaysLogged = input.workDaysLogged ?? 0;

  const isFinished = ['Completed', 'Closed'].includes(input.status);
  const isActive = input.status === 'Active' || input.status === 'PendingAcceptance';

  if (isFinished && input.completedAt) {
    const completed = toDateOnly(input.completedAt);
    const daysEarly = Math.max(0, dayDiff(completed, end));
    const daysLate = Math.max(0, dayDiff(end, completed));

    if (completed < end) {
      return {
        scheduledDays: days,
        scheduledStart: start,
        scheduledEnd: end,
        loggedHours,
        allocatedHours,
        workDaysLogged,
        daysRemaining: 0,
        daysOverdue: 0,
        daysEarly: daysEarly,
        timing: 'completed_early',
        label: 'Finished early',
        detail: `Completed ${daysEarly} day${daysEarly === 1 ? '' : 's'} before schedule (${completed} vs planned end ${end})`,
        isComplete: true,
      };
    }
    if (completed === end) {
      return {
        scheduledDays: days,
        scheduledStart: start,
        scheduledEnd: end,
        loggedHours,
        allocatedHours,
        workDaysLogged,
        daysRemaining: 0,
        daysOverdue: 0,
        daysEarly: 0,
        timing: 'completed_on_time',
        label: 'Finished on time',
        detail: `Completed on the planned end date (${end})`,
        isComplete: true,
      };
    }
    return {
      scheduledDays: days,
      scheduledStart: start,
      scheduledEnd: end,
      loggedHours,
      allocatedHours,
      workDaysLogged,
      daysRemaining: 0,
      daysOverdue: daysLate,
      daysEarly: 0,
      timing: 'completed_late',
      label: 'Finished late',
      detail: `Exceeded schedule by ${daysLate} day${daysLate === 1 ? '' : 's'} (completed ${completed}, planned end ${end})`,
      isComplete: true,
    };
  }

  if (isActive && today > end) {
    const daysOverdue = dayDiff(end, today);
    return {
      scheduledDays: days,
      scheduledStart: start,
      scheduledEnd: end,
      loggedHours,
      allocatedHours,
      workDaysLogged,
      daysRemaining: 0,
      daysOverdue,
      daysEarly: 0,
      timing: 'overdue',
      label: 'Overdue',
      detail: `Still active — ${daysOverdue} day${daysOverdue === 1 ? '' : 's'} past planned end (${end})`,
      isComplete: false,
    };
  }

  if (isActive) {
    const daysRemaining = Math.max(0, dayDiff(today, end));
    return {
      scheduledDays: days,
      scheduledStart: start,
      scheduledEnd: end,
      loggedHours,
      allocatedHours,
      workDaysLogged,
      daysRemaining,
      daysOverdue: 0,
      daysEarly: 0,
      timing: 'in_progress',
      label: 'In progress',
      detail: `${daysRemaining} day${daysRemaining === 1 ? '' : 's'} left in ${days}-day window (ends ${end})`,
      isComplete: false,
    };
  }

  return {
    scheduledDays: days,
    scheduledStart: start,
    scheduledEnd: end,
    loggedHours,
    allocatedHours,
    workDaysLogged,
    daysRemaining: Math.max(0, dayDiff(today, end)),
    daysOverdue: 0,
    daysEarly: 0,
    timing: 'scheduled',
    label: 'Scheduled',
    detail: `${days}-day window: ${start} → ${end}`,
    isComplete: false,
  };
}

import { prisma } from '../lib/prisma.js';

type JobWithAssignments = {
  id: number;
  startDate: Date;
  endDate: Date;
  status: string;
  completedAt: Date | null;
  estimatedHours: number;
  assignments?: { status: string; allocatedHours: number }[];
};

export async function buildJobProgress(job: JobWithAssignments) {
  const logs = await prisma.activityLog.findMany({
    where: { jobId: job.id },
    select: { hours: true, logDate: true },
  });
  const loggedHours = logs.reduce((sum, log) => sum + log.hours, 0);
  const workDaysLogged = new Set(logs.map((log) => log.logDate.toISOString().slice(0, 10))).size;
  const allocatedHours =
    job.assignments
      ?.filter((a) => !['Cancelled', 'Rejected'].includes(a.status))
      .reduce((sum, a) => sum + a.allocatedHours, 0) || job.estimatedHours;

  return computeJobProgress({
    startDate: job.startDate,
    endDate: job.endDate,
    status: job.status,
    completedAt: job.completedAt,
    estimatedHours: job.estimatedHours,
    allocatedHours,
    loggedHours,
    workDaysLogged,
  });
}

export function timingBadgeClass(timing: JobTiming) {
  switch (timing) {
    case 'completed_early':
    case 'completed_on_time':
      return 'bg-teal/10 text-teal';
    case 'completed_late':
    case 'overdue':
      return 'bg-red-100 text-red-700';
    case 'in_progress':
      return 'bg-blue-50 text-blue-800';
    default:
      return 'bg-slate-100 text-slate-600';
  }
}
