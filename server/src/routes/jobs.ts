import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  assignInspector,
  cancelJob,
  completeJob,
  recordJobStatus,
  releaseJobForAssignment,
  removeAssignmentFromTeam,
  runJobAssessment,
} from '../services/jobWorkflow.js';
import { listAssignCandidates } from '../services/assignCandidates.js';
import { recordAudit } from '../services/audit.js';
import { certSummaryForJob } from '../services/jobCerts.js';
import { resolveDefaultPriceUsd } from '../services/pricing.js';
import { geocodeSampleLocation } from '../lib/geo.js';
import {
  assertCanAccessJob,
  assertCanCompleteJob,
  getInspectorForUser,
  inspectorJobListWhere,
  isStaff,
  STAFF_ROLES,
} from '../services/authz.js';
import { sendRouteError } from '../lib/httpErrors.js';
import { buildJobProgress } from '../services/jobProgress.js';
import { validateBody } from '../lib/validate.js';
import {
  assignJobSchema,
  cancelJobSchema,
  completeJobSchema,
  createJobSchema,
  updateJobPriceSchema,
  updateJobSchema,
} from '../lib/schemas.js';

const router = Router();
router.use(authMiddleware);

const inspectorOnAssignment = {
  include: {
    department: true,
    inspectorCerts: { include: { certification: true } },
  },
};

const jobInclude = {
  client: true,
  department: true,
  jobType: { include: { certRequirements: { include: { certification: true } } } },
  certRequirements: { include: { certification: true } },
  proposals: { include: { inspector: { include: { department: true } } }, orderBy: { rank: 'asc' as const } },
  assignments: { include: { inspector: inspectorOnAssignment }, orderBy: { createdAt: 'desc' as const } },
  timesheets: { include: { inspector: { include: { department: true } } } },
  statusHistory: { orderBy: { createdAt: 'desc' as const }, take: 20 },
};

const listInclude = {
  client: true,
  department: true,
  jobType: { include: { certRequirements: { include: { certification: true } } } },
  certRequirements: { include: { certification: true } },
  assignments: { include: { inspector: inspectorOnAssignment } },
};

function withCertSummary<T extends Parameters<typeof certSummaryForJob>[0]>(job: T) {
  return { ...job, certSummary: certSummaryForJob(job) };
}

async function coordsForJob(clientId: number, location?: string | null) {
  const fromLocation = geocodeSampleLocation(location);
  if (fromLocation) return fromLocation;
  const client = await prisma.client.findUnique({ where: { id: clientId } });
  if (client?.latitude != null && client?.longitude != null) {
    return { latitude: client.latitude, longitude: client.longitude };
  }
  return geocodeSampleLocation(client?.location) ?? null;
}

router.get('/', async (req, res) => {
  const status = req.query.status as string | undefined;
  let scope: Record<string, unknown> = {};
  if (!isStaff(req.user!.role)) {
    const inspector = await getInspectorForUser(req.user!);
    if (!inspector) {
      res.json([]);
      return;
    }
    scope = inspectorJobListWhere(inspector.id);
  }
  const jobs = await prisma.job.findMany({
    where: {
      ...scope,
      ...(status ? { status: status as never } : {}),
    },
    include: listInclude,
    orderBy: { updatedAt: 'desc' },
  });
  res.json(jobs.map((j) => withCertSummary(j)));
});

/** Possible duplicates: same client + dept + (jobType or title) with overlapping dates. */
router.get('/duplicates', requireRole(...STAFF_ROLES), async (req, res) => {
  const clientId = Number(req.query.clientId);
  const departmentId = Number(req.query.departmentId);
  const startDate = typeof req.query.startDate === 'string' ? req.query.startDate.slice(0, 10) : '';
  const endDate = typeof req.query.endDate === 'string' ? req.query.endDate.slice(0, 10) : '';
  const jobTypeId = req.query.jobTypeId ? Number(req.query.jobTypeId) : undefined;
  const title = typeof req.query.title === 'string' ? req.query.title.trim() : '';
  const excludeId = req.query.excludeId ? Number(req.query.excludeId) : undefined;

  if (!Number.isFinite(clientId) || !Number.isFinite(departmentId) || !startDate || !endDate) {
    res.status(400).json({ error: 'clientId, departmentId, startDate, and endDate are required' });
    return;
  }
  if (!(jobTypeId && Number.isFinite(jobTypeId)) && !title) {
    res.json({ items: [] });
    return;
  }

  const start = new Date(startDate + 'T00:00:00');
  const end = new Date(endDate + 'T23:59:59');

  const candidates = await prisma.job.findMany({
    where: {
      clientId,
      departmentId,
      status: { notIn: ['Cancelled'] },
      ...(excludeId && Number.isFinite(excludeId) ? { id: { not: excludeId } } : {}),
      ...(jobTypeId && Number.isFinite(jobTypeId) ? { jobTypeId } : { title }),
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: {
      id: true,
      ref: true,
      title: true,
      status: true,
      startDate: true,
      endDate: true,
      client: { select: { name: true } },
      jobType: { select: { name: true, code: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take: 10,
  });

  res.json({
    items: candidates.map((j) => ({
      id: j.id,
      ref: j.ref,
      title: j.title,
      status: j.status,
      startDate: j.startDate,
      endDate: j.endDate,
      clientName: j.client.name,
      jobTypeName: j.jobType?.name ?? null,
    })),
  });
});

router.get('/pipeline', requireRole(...STAFF_ROLES), async (_req, res) => {
  const jobs = await prisma.job.findMany({
    where: { status: { notIn: ['Cancelled'] } },
    include: {
      ...listInclude,
      proposals: { where: { blocked: false }, include: { inspector: true }, orderBy: { rank: 'asc' } },
      assignments: {
        where: { status: { notIn: ['Cancelled', 'Rejected'] } },
        include: { inspector: inspectorOnAssignment },
      },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const enriched = jobs.map((j) => withCertSummary(j));

  const hasOpenAssignment = (j: (typeof enriched)[0]) =>
    j.assignments.some((a) => ['PendingAcceptance', 'Accepted', 'Active'].includes(a.status));

  const jobStage = (j: (typeof enriched)[0]) => {
    if (j.status === 'Closed' || j.status === 'Completed') return 'completed';
    if (j.status === 'Active' || j.status === 'PendingAcceptance') return 'active';
    if (!hasOpenAssignment(j)) return 'new';
    return 'new';
  };

  const columns = {
    new: enriched.filter((j) => jobStage(j) === 'new'),
    pendingAcceptance: [] as typeof enriched,
    active: enriched.filter((j) => jobStage(j) === 'active'),
    pendingApproval: [] as typeof enriched,
    completed: enriched.filter((j) => jobStage(j) === 'completed'),
  };

  const counts = {
    total: enriched.length,
    new: columns.new.length,
    pendingAcceptance: columns.pendingAcceptance.length,
    active: columns.active.length,
    pendingApproval: columns.pendingApproval.length,
    completed: columns.completed.length,
  };

  res.json({ columns, counts, all: enriched });
});

router.get('/:id', async (req, res) => {
  try {
    await assertCanAccessJob(Number(req.params.id), req.user!);
  } catch (err) {
    sendRouteError(res, err, 'Not found');
    return;
  }
  const job = await prisma.job.findUnique({
    where: { id: Number(req.params.id) },
    include: jobInclude,
  });
  if (!job) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const progress = await buildJobProgress(job);
  const suggestedPriceUsd = job.agreedPriceUsd ?? (await resolveDefaultPriceUsd(job));
  res.json({ ...withCertSummary(job), progress, suggestedPriceUsd });
});

router.post('/', requireRole(...STAFF_ROLES), validateBody(createJobSchema), async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const clientId = Number(body.clientId);
  const location = body.location ? String(body.location) : null;
  const coords = await coordsForJob(clientId, location);
  let certificationIds = (body.certificationIds as number[] | undefined) ?? [];
  const jobTypeId = body.jobTypeId ? Number(body.jobTypeId) : null;
  if (certificationIds.length === 0 && jobTypeId) {
    const typeReqs = await prisma.jobTypeCertRequirement.findMany({ where: { jobTypeId } });
    certificationIds = typeReqs.map((r) => r.certificationId);
  }

  const job = await prisma.job.create({
    data: {
      ref: String(body.ref),
      title: String(body.title),
      clientId,
      departmentId: Number(body.departmentId),
      scope: body.scope ? String(body.scope) : null,
      location,
      latitude: coords?.latitude ?? null,
      longitude: coords?.longitude ?? null,
      startDate: new Date(String(body.startDate)),
      endDate: new Date(String(body.endDate)),
      priority: body.priority ? String(body.priority) : 'Normal',
      estimatedHours: body.estimatedHours ? Number(body.estimatedHours) : 40,
      requiredInspectorCount: body.requiredInspectorCount ? Number(body.requiredInspectorCount) : 1,
      jobTypeId,
      requiresQeApproval: Boolean(body.requiresQeApproval),
      autoCompleteOnEndDate:
        body.autoCompleteOnEndDate === undefined ? true : Boolean(body.autoCompleteOnEndDate),
      rateBasis: body.rateBasis === 'hourly' ? 'hourly' : 'day',
      agreedPriceUsd: body.agreedPriceUsd != null ? Number(body.agreedPriceUsd) : null,
      createdByEmail: req.user?.email,
      status: 'Draft',
      certRequirements: certificationIds.length
        ? {
            create: certificationIds.map((certificationId) => ({
              certificationId,
              mandatory: true,
            })),
          }
        : undefined,
    },
    include: jobInclude,
  });
  // Seed certs from job type when create payload omitted them
  if (certificationIds.length === 0 && jobTypeId) {
    const jt = await prisma.jobType.findUnique({
      where: { id: jobTypeId },
      include: { certRequirements: true },
    });
    if (jt?.certRequirements.length) {
      await prisma.jobCertRequirement.createMany({
        data: jt.certRequirements.map((r) => ({
          jobId: job.id,
          certificationId: r.certificationId,
          mandatory: r.mandatory,
        })),
      });
    }
  }
  const teamSlots = (Array.isArray(body.teamSlots) ? body.teamSlots : []) as {
    inspectorId?: number | null;
    startDate?: string;
    endDate?: string;
    dayRateUsd?: number | null;
  }[];
  const filledSlots = teamSlots.filter((s) => s.inspectorId != null && Number(s.inspectorId) > 0);

  // Land as Proposed first (assign requires Proposed/Active)
  await recordJobStatus(
    job.id,
    'Proposed',
    req.user?.email,
    filledSlots.length
      ? 'Job created — assigning team'
      : 'Job created — awaiting manual assignment'
  );

  if (filledSlots.length > 0) {
    try {
      for (let i = 0; i < filledSlots.length; i++) {
        const slot = filledSlots[i];
        await assignInspector(
          job.id,
          Number(slot.inspectorId),
          i === 0 ? 'Lead' : 'Member',
          body.estimatedHours ? Number(body.estimatedHours) : job.estimatedHours,
          req.user?.email,
          req.user?.id,
          {
            mobDate: slot.startDate,
            demobDate: slot.endDate,
            dayRateUsd: slot.dayRateUsd,
            allowOverfill: true,
          }
        );
      }
    } catch (err) {
      res.status(400).json({
        error: err instanceof Error ? err.message : 'Job created but team assign failed',
        jobId: job.id,
      });
      return;
    }
  }

  const created = await prisma.job.findUnique({ where: { id: job.id }, include: jobInclude });
  res.status(201).json(withCertSummary(created ?? job));
});

router.put('/:id', requireRole(...STAFF_ROLES), validateBody(updateJobSchema), async (req, res) => {
  const jobId = Number(req.params.id);
  const existing = await prisma.job.findUnique({
    where: { id: jobId },
    include: { _count: { select: { activityLogs: true } } },
  });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const fullEdit = ['Draft', 'Proposed'].includes(existing.status);
  const softEdit = ['Active', 'PendingAcceptance'].includes(existing.status);
  if (!fullEdit && !softEdit) {
    res.status(400).json({ error: `Cannot edit job in ${existing.status} status` });
    return;
  }

  const body = req.body as Record<string, unknown>;

  if (softEdit && !fullEdit) {
    const hardKeys = ['clientId', 'departmentId', 'jobTypeId', 'agreedPriceUsd', 'requiresQeApproval'];
    for (const key of hardKeys) {
      if (body[key] !== undefined) {
        res.status(400).json({ error: `Cannot change ${key} while job is ${existing.status}` });
        return;
      }
    }
    if (body.startDate !== undefined) {
      const nextStart = String(body.startDate).slice(0, 10);
      const prevStart = existing.startDate.toISOString().slice(0, 10);
      if (nextStart !== prevStart && existing._count.activityLogs > 0) {
        res.status(400).json({ error: 'Start date cannot change after activity has been logged' });
        return;
      }
      if (nextStart !== prevStart) {
        res.status(400).json({ error: 'Start date is locked on active jobs' });
        return;
      }
    }
  }

  const nextClientId = body.clientId !== undefined ? Number(body.clientId) : existing.clientId;
  const nextLocation =
    body.location !== undefined ? (body.location ? String(body.location) : null) : existing.location;
  const coords = await coordsForJob(nextClientId, nextLocation);

  const softData = {
    title: body.title !== undefined ? String(body.title) : undefined,
    scope: body.scope !== undefined ? (body.scope ? String(body.scope) : null) : undefined,
    location: body.location !== undefined ? (body.location ? String(body.location) : null) : undefined,
    latitude: coords?.latitude ?? undefined,
    longitude: coords?.longitude ?? undefined,
    endDate: body.endDate ? new Date(String(body.endDate)) : undefined,
    priority: body.priority !== undefined ? String(body.priority) : undefined,
    estimatedHours: body.estimatedHours !== undefined ? Number(body.estimatedHours) : undefined,
  };

  const fullData = {
    ...softData,
    startDate: body.startDate ? new Date(String(body.startDate)) : undefined,
    clientId: body.clientId !== undefined ? Number(body.clientId) : undefined,
    departmentId: body.departmentId !== undefined ? Number(body.departmentId) : undefined,
    jobTypeId: body.jobTypeId !== undefined ? (body.jobTypeId ? Number(body.jobTypeId) : null) : undefined,
    requiresQeApproval: body.requiresQeApproval !== undefined ? Boolean(body.requiresQeApproval) : undefined,
    agreedPriceUsd: body.agreedPriceUsd !== undefined ? (body.agreedPriceUsd as number | null) : undefined,
  };

  const job = await prisma.job.update({
    where: { id: jobId },
    data: fullEdit ? fullData : softData,
    include: jobInclude,
  });

  await recordAudit({
    userId: req.user?.id,
    action: 'job.updated',
    entityType: 'Job',
    entityId: jobId,
    payload: {
      ref: job.ref,
      title: job.title,
      mode: fullEdit ? 'full' : 'soft',
      fields: Object.keys(body),
    },
  });
  const fresh = await prisma.job.findUnique({ where: { id: jobId }, include: jobInclude });
  res.json(withCertSummary(fresh ?? job));
});

router.put('/:id/price', requireRole(...STAFF_ROLES), validateBody(updateJobPriceSchema), async (req, res) => {
  const jobId = Number(req.params.id);
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (['Closed', 'Completed', 'Cancelled'].includes(job.status)) {
    res.status(400).json({ error: 'Price cannot be edited after the job is closed' });
    return;
  }
  const { agreedPriceUsd } = req.body as { agreedPriceUsd: number };
  const updated = await prisma.job.update({
    where: { id: jobId },
    data: { agreedPriceUsd },
    include: jobInclude,
  });
  await recordAudit({
    userId: req.user?.id,
    action: 'job.priceUpdated',
    entityType: 'Job',
    entityId: jobId,
    payload: { agreedPriceUsd },
  });
  res.json(withCertSummary(updated));
});

/** Release Draft → Proposed without ranking engine (kept for older Draft rows). */
router.post('/:id/submit', requireRole(...STAFF_ROLES), async (req, res) => {
  const jobId = Number(req.params.id);
  try {
    await releaseJobForAssignment(jobId, req.user?.email);
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: jobInclude });
    res.json({ job: job ? withCertSummary(job) : job });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Submit failed' });
  }
});

router.get('/:id/assign-candidates', requireRole(...STAFF_ROLES), async (req, res) => {
  const jobId = Number(req.params.id);
  const job = await prisma.job.findUnique({ where: { id: jobId } });
  if (!job) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const items = await listAssignCandidates(jobId);
    res.json({ items });
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not load candidates' });
  }
});

router.post('/:id/cancel', requireRole(...STAFF_ROLES), validateBody(cancelJobSchema), async (req, res) => {
  const jobId = Number(req.params.id);
  const { note } = req.body as { note: string };
  try {
    await cancelJob(jobId, note, req.user?.email, req.user?.id);
    const job = await prisma.job.findUnique({ where: { id: jobId }, include: jobInclude });
    if (!job) {
      res.status(404).json({ error: 'Not found' });
      return;
    }
    res.json(withCertSummary(job));
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Cancel failed' });
  }
});

router.post('/:id/assign', requireRole(...STAFF_ROLES), validateBody(assignJobSchema), async (req, res) => {
  const {
    inspectorId,
    role,
    allocatedHours,
    agreedPriceUsd,
    mobDate,
    demobDate,
    dayRateUsd,
    allowOverfill,
  } = req.body as {
    inspectorId: number;
    role?: string;
    allocatedHours?: number;
    agreedPriceUsd?: number | null;
    mobDate?: string;
    demobDate?: string;
    dayRateUsd?: number | null;
    allowOverfill?: boolean;
  };
  const job = await prisma.job.findUnique({ where: { id: Number(req.params.id) } });
  if (!job) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    const assignment = await assignInspector(
      job.id,
      inspectorId,
      role ?? 'Lead',
      allocatedHours ?? job.estimatedHours,
      req.user?.email,
      req.user?.id,
      { agreedPriceUsd, mobDate, demobDate, dayRateUsd, allowOverfill }
    );
    res.json(assignment);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Assign failed' });
  }
});

router.post(
  '/:id/assignments/:assignmentId/remove',
  requireRole(...STAFF_ROLES),
  async (req, res) => {
    const jobId = Number(req.params.id);
    const assignmentId = Number(req.params.assignmentId);
    const existing = await prisma.assignment.findFirst({
      where: { id: assignmentId, jobId },
    });
    if (!existing) {
      res.status(404).json({ error: 'Assignment not found on this job' });
      return;
    }
    try {
      const assignment = await removeAssignmentFromTeam(assignmentId, req.user?.email, req.user?.id);
      res.json(assignment);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Remove failed' });
    }
  }
);

router.post('/:id/rerun-assessment', requireRole(...STAFF_ROLES), async (req, res) => {
  const result = await runJobAssessment(Number(req.params.id), req.user?.email);
  res.json(result);
});

router.post(
  '/:id/complete',
  requireRole('Inspector', 'Coordinator', 'Manager', 'Admin'),
  validateBody(completeJobSchema),
  async (req, res) => {
    const { inspectorId, comments, agreedPriceUsd, members } = req.body as {
      inspectorId: number;
      comments?: string;
      agreedPriceUsd?: number | null;
      members?: {
        assignmentId: number;
        mobDate?: string | null;
        demobDate?: string | null;
        dailyCostUsd?: number | null;
        dailyBillableUsd?: number | null;
      }[];
    };
    try {
      await assertCanCompleteJob(Number(req.params.id), inspectorId, req.user!);
      const staffPrice = isStaff(req.user!.role) ? agreedPriceUsd : undefined;
      const staffMembers = isStaff(req.user!.role) ? members : undefined;
      const job = await completeJob(Number(req.params.id), inspectorId, comments ?? '', req.user?.email, {
        agreedPriceUsd: staffPrice,
        members: staffMembers,
      });
      await recordAudit({
        userId: req.user?.id,
        action: 'job.completed',
        entityType: 'Job',
        entityId: Number(req.params.id),
        payload: { inspectorId, comments: comments ?? '', agreedPriceUsd: staffPrice, members: staffMembers },
      });
      res.json(job);
    } catch (err) {
      sendRouteError(res, err, 'Complete failed');
    }
  }
);

export default router;
