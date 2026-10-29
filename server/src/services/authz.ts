import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import type { AuthUser } from '../middleware/auth.js';

export const STAFF_ROLES: UserRole[] = ['Coordinator', 'Manager', 'Admin'];

export const ACTIVE_ASSIGNMENT_STATUSES = ['Accepted', 'Active'] as const;

export function isStaff(role: UserRole) {
  return STAFF_ROLES.includes(role);
}

export function isAdmin(role: UserRole) {
  return role === 'Admin';
}

export class AuthzError extends Error {
  status: number;
  constructor(message: string, status = 403) {
    super(message);
    this.name = 'AuthzError';
    this.status = status;
  }
}

export async function getInspectorForUser(user: AuthUser) {
  if (user.inspectorId) {
    const inspector = await prisma.inspector.findUnique({ where: { id: user.inspectorId } });
    if (inspector) return inspector;
  }
  return prisma.inspector.findFirst({ where: { email: user.email } });
}

function inspectorMatchesUser(
  inspector: { id: number; userId: number | null; email: string | null },
  user: AuthUser
) {
  if (inspector.userId && inspector.userId === user.id) return true;
  if (user.inspectorId && inspector.id === user.inspectorId) return true;
  if (inspector.email && inspector.email === user.email) return true;
  return false;
}

export async function getAssignmentForUser(assignmentId: number, user: AuthUser) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { inspector: true, job: true },
  });
  if (!assignment) throw new AuthzError('Assignment not found', 404);
  if (user.role === 'Inspector' && !inspectorMatchesUser(assignment.inspector, user)) {
    throw new AuthzError('Forbidden');
  }
  return assignment;
}

export async function assertCanCompleteJob(jobId: number, inspectorId: number, user: AuthUser) {
  if (user.role === 'Inspector') {
    const inspector = await getInspectorForUser(user);
    if (!inspector || inspector.id !== inspectorId) {
      throw new AuthzError('Forbidden');
    }
  }

  const assignment = await prisma.assignment.findFirst({
    where: {
      jobId,
      inspectorId,
      status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
    },
  });
  if (!assignment) {
    throw new AuthzError('Inspector is not assigned to this active job');
  }
}

/** Inspector (or the named inspectorId for staff) must have an Accepted/Active assignment on the job. */
export async function assertCanLogActivity(jobId: number, inspectorId: number, user: AuthUser) {
  if (user.role === 'Inspector') {
    const inspector = await getInspectorForUser(user);
    if (!inspector || inspector.id !== inspectorId) {
      throw new AuthzError('Forbidden');
    }
  }

  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AuthzError('Job not found', 404);

  const assignment = await prisma.assignment.findFirst({
    where: {
      jobId,
      inspectorId,
      status: { in: [...ACTIVE_ASSIGNMENT_STATUSES] },
    },
  });
  if (!assignment) {
    throw new AuthzError('Inspector is not on an active assignment for this job');
  }
}

export async function assertCanAccessJob(jobId: number, user: AuthUser) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new AuthzError('Job not found', 404);
  if (isStaff(user.role)) return job;

  const inspector = await getInspectorForUser(user);
  if (!inspector) throw new AuthzError('Job not found', 404);

  const assignment = await prisma.assignment.findFirst({
    where: { jobId, inspectorId: inspector.id },
  });
  if (!assignment) throw new AuthzError('Job not found', 404);
  return job;
}

export function inspectorJobListWhere(inspectorId: number) {
  return { assignments: { some: { inspectorId } } };
}

export async function getTimesheetForUser(timesheetId: number, user: AuthUser) {
  const ts = await prisma.timesheet.findUnique({
    where: { id: timesheetId },
    include: {
      inspector: { include: { department: true } },
      lines: { orderBy: { logDate: 'asc' } },
    },
  });
  if (!ts) throw new AuthzError('Timesheet not found', 404);
  if (user.role === 'Inspector' && !inspectorMatchesUser(ts.inspector, user)) {
    throw new AuthzError('Forbidden');
  }
  return ts;
}
