import type { JobStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { rankInspectorsForJob } from './assignmentEngine.js';
import { recordAudit } from './audit.js';
import { notifyRoles, notifyUser } from './notifications.js';
import { resolveDefaultPriceUsd } from './pricing.js';
import { rateForJobBasis } from './jobTypeRates.js';
import { ensureAutoActivityLogs } from './autoActivityLogs.js';

/** Promote leftover statuses after workflow simplifications (no accept step, no post-assign QE). */
export async function promoteAssignedJobsToActive() {
  await prisma.job.updateMany({
    where: { status: 'PendingAcceptance' },
    data: { status: 'Active' },
  });
  await prisma.assignment.updateMany({
    where: { status: 'PendingAcceptance' },
    data: { status: 'Active' },
  });
  await prisma.job.updateMany({
    where: { status: 'Completed' },
    data: { status: 'Closed' },
  });

  // Old CM-007: Proposed assignment waiting for Manager QE-approve → Active if inspector is QE-approved, else cancel.
  const stuck = await prisma.assignment.findMany({
    where: {
      status: 'Proposed',
      job: { requiresQeApproval: true, status: { in: ['Draft', 'Proposed'] } },
    },
    include: { inspector: true, job: true },
  });
  for (const a of stuck) {
    if (a.inspector.qeApproved) {
      await prisma.assignment.update({ where: { id: a.id }, data: { status: 'Active' } });
      if (a.job.status !== 'Active') {
        await recordJobStatus(a.jobId, 'Active', undefined, `Migrated: ${a.inspector.name} (QE-approved)`);
      }
    } else {
      await prisma.assignment.update({
        where: { id: a.id },
        data: {
          status: 'Cancelled',
          decidedAt: new Date(),
          rejectReason: 'Cancelled — inspector is not QE-approved (CM-010)',
        },
      });
    }
  }

  await autoCloseJobsPastEndDate();
}

/**
 * CM-024: assigned jobs with autoCompleteOnEndDate close when calendar end date has passed.
 * Manual-complete jobs are left open (may show overdue) until staff/inspector marks complete.
 */
export async function autoCloseJobsPastEndDate() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const due = await prisma.job.findMany({
    where: {
      autoCompleteOnEndDate: true,
      status: { in: ['Active', 'PendingAcceptance'] },
      endDate: { lt: today },
      assignments: { some: { status: { in: ['Accepted', 'Active', 'PendingAcceptance'] } } },
    },
    select: { id: true, ref: true },
  });

  for (const job of due) {
    await prisma.job.update({
      where: { id: job.id },
      data: {
        completedAt: new Date(),
        completedByEmail: 'system:auto-complete',
        closingComments: 'Auto-completed on end date (CM-024)',
      },
    });
    await prisma.assignment.updateMany({
      where: { jobId: job.id, status: { in: ['Accepted', 'Active', 'PendingAcceptance'] } },
      data: { status: 'Complete' },
    });
    await recordJobStatus(job.id, 'Closed', 'system:auto-complete', 'Auto-completed on end date');
  }
}

export async function recordJobStatus(jobId: number, toStatus: JobStatus, userEmail?: string, note?: string) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) return;
  await prisma.jobStatusHistory.create({
    data: { jobId, fromStatus: job.status, toStatus, userEmail, note },
  });
  await prisma.job.update({ where: { id: jobId }, data: { status: toStatus } });
}

export async function runJobAssessment(jobId: number, userEmail?: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      client: true,
      jobType: { include: { certRequirements: { include: { certification: true } } } },
      certRequirements: { include: { certification: true } },
    },
  });
  if (!job) throw new Error('Job not found');

  if (job.certRequirements.length === 0 && job.jobType?.certRequirements.length) {
    await prisma.jobCertRequirement.createMany({
      data: job.jobType.certRequirements.map((r) => ({
        jobId,
        certificationId: r.certificationId,
        mandatory: r.mandatory,
      })),
    });
  }

  const jobForRank = await prisma.job.findUniqueOrThrow({
    where: { id: jobId },
    include: {
      client: true,
      certRequirements: { include: { certification: true } },
    },
  });

  await prisma.assignmentProposal.deleteMany({ where: { jobId } });

  const inspectors = await prisma.inspector.findMany({
    include: { inspectorCerts: { include: { certification: true } } },
  });

  const leaveRequests = await prisma.leaveRequest.findMany({
    where: { status: 'Approved' },
  });

  const activeAssignments = await prisma.assignment.findMany({
    where: { status: { in: ['Accepted', 'Active', 'PendingAcceptance', 'Proposed'] } },
    include: {
      job: { include: { client: true } },
    },
  });
  const workloadByInspector = new Map<number, number>();
  for (const a of activeAssignments) {
    if (['Accepted', 'Active', 'PendingAcceptance'].includes(a.status)) {
      workloadByInspector.set(a.inspectorId, (workloadByInspector.get(a.inspectorId) ?? 0) + a.allocatedHours);
    }
  }

  const ranked = await rankInspectorsForJob(
    jobForRank,
    inspectors,
    leaveRequests,
    workloadByInspector,
    activeAssignments.map((a) => ({ inspectorId: a.inspectorId, job: a.job }))
  );
  const top = ranked.filter((r) => !r.blocked).slice(0, 3);

  for (const p of ranked.slice(0, 10)) {
    await prisma.assignmentProposal.create({
      data: {
        jobId,
        inspectorId: p.inspectorId,
        score: p.score,
        rank: p.rank,
        blocked: p.blocked,
        blockReasons: p.blockReasons.join('; ') || null,
        warnings: p.warnings.join('; ') || null,
      },
    });
  }

  await recordJobStatus(jobId, 'Proposed', userEmail, `Engine proposed ${top.length} eligible inspector(s)`);
  return { proposals: top, all: ranked.slice(0, 10) };
}

/** Move Draft → Proposed without running the ranking engine (manual assign flow). */
export async function releaseJobForAssignment(jobId: number, userEmail?: string) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      jobType: { include: { certRequirements: true } },
      certRequirements: true,
    },
  });
  if (!job) throw new Error('Job not found');

  if (job.certRequirements.length === 0 && job.jobType?.certRequirements.length) {
    await prisma.jobCertRequirement.createMany({
      data: job.jobType.certRequirements.map((r) => ({
        jobId,
        certificationId: r.certificationId,
        mandatory: r.mandatory,
      })),
    });
  }

  if (job.status === 'Draft') {
    await recordJobStatus(jobId, 'Proposed', userEmail, 'Released for manual assignment');
  } else if (job.status !== 'Proposed') {
    throw new Error(`Cannot release job in ${job.status} status`);
  }

  return prisma.job.findUniqueOrThrow({ where: { id: jobId } });
}

function parseDay(ymd?: string | null): Date | null {
  if (!ymd) return null;
  const d = new Date(ymd.slice(0, 10) + 'T00:00:00');
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Presence window for an assignment; falls back to job dates. */
export function assignmentWindow(
  assignment: { mobDate?: Date | null; demobDate?: Date | null },
  job: { startDate: Date; endDate: Date }
) {
  return {
    start: assignment.mobDate ?? job.startDate,
    end: assignment.demobDate ?? job.endDate,
  };
}

export async function assignInspector(
  jobId: number,
  inspectorId: number,
  role: string,
  allocatedHours: number,
  userEmail?: string,
  userId?: number,
  options?: {
    agreedPriceUsd?: number | null;
    mobDate?: string;
    demobDate?: string;
    dayRateUsd?: number | null;
    allowOverfill?: boolean;
  }
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      assignments: {
        where: { status: { in: ['PendingAcceptance', 'Accepted', 'Active', 'Proposed'] } },
        include: { inspector: true },
      },
    },
  });
  if (!job) throw new Error('Job not found');

  const allowedJobStatuses = ['Proposed', 'PendingAcceptance', 'Active'];
  if (!allowedJobStatuses.includes(job.status)) {
    throw new Error(`Cannot assign inspector while job is ${job.status}`);
  }

  const inspector = await prisma.inspector.findUnique({ where: { id: inspectorId } });
  if (!inspector) throw new Error('Inspector not found');
  /** QE flag is advisory: staff may assign a non–QE-approved inspector after UI warning. */
  const qeOverride = Boolean(job.requiresQeApproval && !inspector.qeApproved);

  const assignmentStatus = 'Active' as const;

  const mobDate = parseDay(options?.mobDate) ?? job.startDate;
  const demobDate = parseDay(options?.demobDate) ?? job.endDate;
  if (demobDate < mobDate) {
    throw new Error('Demob date must be on or after mob date');
  }

  const priceToStore =
    options?.agreedPriceUsd !== undefined && options.agreedPriceUsd !== null
      ? options.agreedPriceUsd
      : job.agreedPriceUsd ?? (await resolveDefaultPriceUsd(job));

  const jobType =
    job.jobTypeId != null
      ? await prisma.jobType.findUnique({ where: { id: job.jobTypeId } })
      : null;
  const typeRate = rateForJobBasis(job.rateBasis, jobType);

  /** Freeze rates onto the assignment (billable = job type / override; CTC Admin-only elsewhere). */
  const costSnapshot = {
    dailyCostUsd: inspector.dailyCostUsd ?? null,
    dailyBillableUsd:
      options?.dayRateUsd !== undefined && options.dayRateUsd !== null
        ? options.dayRateUsd
        : typeRate ?? inspector.dailyBillableUsd ?? null,
  };

  const existingForInspector = job.assignments.find(
    (a) =>
      a.inspectorId === inspectorId &&
      ['PendingAcceptance', 'Accepted', 'Active', 'Proposed'].includes(a.status)
  );
  if (existingForInspector) {
    await prisma.assignment.update({
      where: { id: existingForInspector.id },
      data: {
        status: assignmentStatus,
        mobDate,
        demobDate,
        allocatedHours,
        role,
        ...costSnapshot,
      },
    });
    if (priceToStore != null) {
      await prisma.job.update({ where: { id: jobId }, data: { agreedPriceUsd: priceToStore } });
    }
    if (job.status !== 'Active') {
      await recordJobStatus(
        jobId,
        'Active',
        userEmail,
        qeOverride
          ? `Assigned ${existingForInspector.inspector.name} (QE requirement overridden)`
          : `Assigned ${existingForInspector.inspector.name}`
      );
    }
    await recordAudit({
      userId,
      action: 'job.assigned',
      entityType: 'Job',
      entityId: jobId,
      payload: {
        inspectorId,
        inspectorName: inspector.name,
        role,
        allocatedHours,
        mobDate: mobDate.toISOString().slice(0, 10),
        demobDate: demobDate.toISOString().slice(0, 10),
        requiresQeApproval: job.requiresQeApproval,
        qeOverride,
        agreedPriceUsd: priceToStore,
      },
    });
    await ensureAutoActivityLogs(jobId);
    return prisma.assignment.findUniqueOrThrow({
      where: { id: existingForInspector.id },
      include: { inspector: true },
    });
  }

  const openCount = job.assignments.length;
  const required = job.requiredInspectorCount ?? 1;
  if (openCount >= required && !options?.allowOverfill) {
    throw new Error(
      `Team already has ${openCount}/${required} inspectors. Confirm overfill to add another.`
    );
  }

  // Team-fill: do not cancel other open members (unlike legacy single-assignee reassign).
  const assignment = await prisma.assignment.create({
    data: {
      jobId,
      inspectorId,
      role: openCount === 0 ? role || 'Lead' : role || 'Member',
      allocatedHours,
      status: assignmentStatus,
      createdByEmail: userEmail,
      mobDate,
      demobDate,
      ...costSnapshot,
    },
    include: { inspector: true },
  });

  if (priceToStore != null) {
    await prisma.job.update({
      where: { id: jobId },
      data: { agreedPriceUsd: priceToStore },
    });
  }

  await recordJobStatus(
    jobId,
    'Active',
    userEmail,
    qeOverride
      ? `Added ${inspector.name} to team (QE requirement overridden)`
      : `Added ${inspector.name} to team`
  );
  if (inspector.email) {
    await notifyUser(
      inspector.email,
      'New job assignment',
      `You have been assigned to ${job.ref} — ${job.title}. The job is now active.`,
      `/jobs/${jobId}`
    );
  }

  await recordAudit({
    userId,
    action: 'job.assigned',
    entityType: 'Job',
    entityId: jobId,
    payload: {
      inspectorId,
      inspectorName: inspector.name,
      role: assignment.role,
      allocatedHours,
      mobDate: mobDate.toISOString().slice(0, 10),
      demobDate: demobDate.toISOString().slice(0, 10),
      teamSize: openCount + 1,
      requiredInspectorCount: required,
      requiresQeApproval: job.requiresQeApproval,
      qeOverride,
      agreedPriceUsd: priceToStore,
    },
  });

  await ensureAutoActivityLogs(jobId);
  return assignment;
}

/** Remove one open team member without cancelling the whole job. */
export async function removeAssignmentFromTeam(
  assignmentId: number,
  userEmail?: string,
  userId?: number
) {
  const assignment = await prisma.assignment.findUnique({
    where: { id: assignmentId },
    include: { inspector: true, job: true },
  });
  if (!assignment) throw new Error('Assignment not found');
  if (!['Proposed', 'PendingAcceptance', 'Accepted', 'Active'].includes(assignment.status)) {
    throw new Error('Assignment is not open');
  }

  await prisma.assignment.update({
    where: { id: assignmentId },
    data: {
      status: 'Cancelled',
      decidedAt: new Date(),
      rejectReason: 'Removed from team by coordinator',
    },
  });

  await recordAudit({
    userId,
    action: 'assignment.removed',
    entityType: 'Assignment',
    entityId: assignmentId,
    payload: {
      jobId: assignment.jobId,
      inspectorId: assignment.inspectorId,
      inspectorName: assignment.inspector.name,
      by: userEmail,
    },
  });

  return prisma.assignment.findUniqueOrThrow({
    where: { id: assignmentId },
    include: { inspector: true },
  });
}

export async function acceptAssignment(assignmentId: number, userEmail?: string) {
  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: 'Accepted', decidedAt: new Date() },
    include: { job: true, inspector: true },
  });
  await prisma.assignmentResponse.create({
    data: { assignmentId, accepted: true, userEmail },
  });
  await recordJobStatus(assignment.jobId, 'Active', userEmail, `${assignment.inspector.name} accepted`);

  await notifyRoles(
    ['Coordinator', 'Manager'],
    'Assignment accepted',
    `${assignment.inspector.name} accepted ${assignment.job.ref}`,
    `/jobs/${assignment.jobId}`
  );

  return assignment;
}

export async function rejectAssignment(assignmentId: number, reason: string, userEmail?: string) {
  const assignment = await prisma.assignment.update({
    where: { id: assignmentId },
    data: { status: 'Rejected', rejectReason: reason, decidedAt: new Date() },
    include: { job: true, inspector: true },
  });
  await prisma.assignmentResponse.create({
    data: { assignmentId, accepted: false, reason, userEmail },
  });
  await runJobAssessment(assignment.jobId, userEmail);

  await notifyRoles(
    ['Coordinator', 'Manager'],
    'Assignment declined',
    `${assignment.inspector.name} declined ${assignment.job.ref}: ${reason}`,
    `/jobs/${assignment.jobId}`
  );

  return assignment;
}

const CANCELABLE_STATUSES = ['Draft', 'Proposed', 'PendingAcceptance', 'Active'] as const;

/** Soft-cancel a job with a required note. Open assignments are cancelled. */
export async function cancelJob(jobId: number, note: string, userEmail?: string, userId?: number) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: { assignments: true },
  });
  if (!job) throw new Error('Job not found');
  if (job.status === 'Cancelled') throw new Error('Job is already cancelled');
  if (job.status === 'Closed' || job.status === 'Completed') {
    throw new Error('Completed jobs cannot be cancelled');
  }
  if (!CANCELABLE_STATUSES.includes(job.status as (typeof CANCELABLE_STATUSES)[number])) {
    throw new Error(`Cannot cancel job in ${job.status} status`);
  }

  await prisma.assignment.updateMany({
    where: {
      jobId,
      status: { in: ['Proposed', 'PendingAcceptance', 'Accepted', 'Active'] },
    },
    data: {
      status: 'Cancelled',
      decidedAt: new Date(),
      rejectReason: `Job cancelled: ${note}`,
    },
  });

  await recordJobStatus(jobId, 'Cancelled', userEmail, note);
  await recordAudit({
    userId,
    action: 'job.cancelled',
    entityType: 'Job',
    entityId: jobId,
    payload: { ref: job.ref, title: job.title, note },
  });

  return prisma.job.findUniqueOrThrow({ where: { id: jobId } });
}

export type CompleteJobMemberUpdate = {
  assignmentId: number;
  mobDate?: string | null;
  demobDate?: string | null;
  dailyCostUsd?: number | null;
  dailyBillableUsd?: number | null;
};

export async function completeJob(
  jobId: number,
  inspectorId: number,
  comments: string,
  userEmail?: string,
  options?: { agreedPriceUsd?: number | null; members?: CompleteJobMemberUpdate[] }
) {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      assignments: {
        where: { status: { in: ['Accepted', 'Active', 'PendingAcceptance'] } },
      },
    },
  });
  if (!job) throw new Error('Job not found');
  if (job.status !== 'Active' && job.status !== 'PendingAcceptance') {
    throw new Error('Only active jobs can be marked complete');
  }

  if (options?.members?.length) {
    for (const m of options.members) {
      const existing = job.assignments.find((a) => a.id === m.assignmentId);
      if (!existing) throw new Error(`Assignment ${m.assignmentId} is not open on this job`);
      const mobDate =
        m.mobDate === undefined ? undefined : m.mobDate === null ? null : parseDay(m.mobDate);
      const demobDate =
        m.demobDate === undefined ? undefined : m.demobDate === null ? null : parseDay(m.demobDate);
      const nextMob = mobDate === undefined ? existing.mobDate ?? job.startDate : mobDate ?? job.startDate;
      const nextDemob =
        demobDate === undefined ? existing.demobDate ?? job.endDate : demobDate ?? job.endDate;
      if (nextDemob < nextMob) {
        throw new Error(`Demob must be on or after mob for assignment ${m.assignmentId}`);
      }
      await prisma.assignment.update({
        where: { id: m.assignmentId },
        data: {
          ...(mobDate !== undefined ? { mobDate } : {}),
          ...(demobDate !== undefined ? { demobDate } : {}),
          ...(m.dailyCostUsd !== undefined ? { dailyCostUsd: m.dailyCostUsd } : {}),
          ...(m.dailyBillableUsd !== undefined ? { dailyBillableUsd: m.dailyBillableUsd } : {}),
        },
      });
    }
  }

  await prisma.job.update({
    where: { id: jobId },
    data: {
      closingComments: comments,
      completedAt: new Date(),
      completedByEmail: userEmail,
      ...(options?.agreedPriceUsd != null ? { agreedPriceUsd: options.agreedPriceUsd } : {}),
    },
  });

  // Close all open team members (multi-PAX), not only the acting inspector.
  await prisma.assignment.updateMany({
    where: { jobId, status: { in: ['Accepted', 'Active', 'PendingAcceptance'] } },
    data: { status: 'Complete' },
  });

  await recordJobStatus(jobId, 'Closed', userEmail, 'Work completed');

  await notifyRoles(
    ['Coordinator', 'Manager'],
    'Job completed',
    `${job.ref} has been marked complete and is now closed`,
    `/jobs/${jobId}`
  );

  return prisma.job.findUnique({
    where: { id: jobId },
    include: { client: true, department: true, jobType: true, assignments: { include: { inspector: true } } },
  });
}
