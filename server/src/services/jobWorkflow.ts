import type { JobStatus } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { rankInspectorsForJob } from './assignmentEngine.js';
import { recordAudit } from './audit.js';
import { notifyRoles, notifyUser } from './notifications.js';
import { resolveDefaultPriceUsd } from './pricing.js';

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

export async function assignInspector(
  jobId: number,
  inspectorId: number,
  role: string,
  allocatedHours: number,
  userEmail?: string,
  userId?: number,
  options?: { agreedPriceUsd?: number | null }
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
  if (job.requiresQeApproval && !inspector.qeApproved) {
    throw new Error(
      `${inspector.name} is not QE-approved. This job requires a QE-approved inspector — mark them on the inspector profile first.`
    );
  }

  const assignmentStatus = 'Active' as const;

  const priceToStore =
    options?.agreedPriceUsd !== undefined && options.agreedPriceUsd !== null
      ? options.agreedPriceUsd
      : job.agreedPriceUsd ?? (await resolveDefaultPriceUsd(job));

  /** Freeze inspector rates onto the assignment so later CTC edits do not rewrite past cost (CM-013). */
  const costSnapshot = {
    dailyCostUsd: inspector.dailyCostUsd ?? null,
    dailyBillableUsd: inspector.dailyBillableUsd ?? null,
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
        ...costSnapshot,
      },
    });
    if (priceToStore != null) {
      await prisma.job.update({ where: { id: jobId }, data: { agreedPriceUsd: priceToStore } });
    }
    if (job.status !== 'Active') {
      await recordJobStatus(jobId, 'Active', userEmail, `Assigned ${existingForInspector.inspector.name}`);
    }
    return prisma.assignment.findUniqueOrThrow({
      where: { id: existingForInspector.id },
      include: { inspector: true },
    });
  }

  for (const a of job.assignments) {
    await prisma.assignment.update({
      where: { id: a.id },
      data: {
        status: 'Cancelled',
        decidedAt: new Date(),
        rejectReason: a.inspectorId === inspectorId ? null : 'Reassigned by coordinator',
      },
    });
  }

  const assignment = await prisma.assignment.create({
    data: {
      jobId,
      inspectorId,
      role,
      allocatedHours,
      status: assignmentStatus,
      createdByEmail: userEmail,
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

  const action = job.assignments.length > 0 ? 'Reassigned to' : 'Assigned';
  await recordJobStatus(jobId, 'Active', userEmail, `${action} ${inspector.name}`);
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
      role,
      allocatedHours,
      requiresQeApproval: job.requiresQeApproval,
      agreedPriceUsd: priceToStore,
    },
  });

  return assignment;
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

export async function completeJob(
  jobId: number,
  inspectorId: number,
  comments: string,
  userEmail?: string,
  options?: { agreedPriceUsd?: number | null }
) {
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) throw new Error('Job not found');
  if (job.status !== 'Active' && job.status !== 'PendingAcceptance') {
    throw new Error('Only active jobs can be marked complete');
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

  await prisma.assignment.updateMany({
    where: { jobId, inspectorId, status: { in: ['Accepted', 'Active', 'PendingAcceptance'] } },
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
