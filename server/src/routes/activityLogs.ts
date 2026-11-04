import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, type AuthUser } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { assertCanLogActivity, getInspectorForUser, isStaff } from '../services/authz.js';
import { sendRouteError } from '../lib/httpErrors.js';
import { validateBody } from '../lib/validate.js';
import {
  createActivityLogSchema,
  createActivityLogBatchSchema,
  updateActivityLogSchema,
} from '../lib/schemas.js';

const router = Router();
router.use(authMiddleware);

const logInclude = {
  inspector: { include: { department: true } },
  job: { include: { client: true } },
};

function dateKey(d: Date | string) {
  const iso = typeof d === 'string' ? d : d.toISOString();
  return iso.slice(0, 10);
}

async function canEditLog(user: AuthUser, log: { inspectorId: number }) {
  if (isStaff(user.role)) return true;
  const inspector = await getInspectorForUser(user);
  return inspector?.id === log.inspectorId;
}

router.post('/', validateBody(createActivityLogSchema), async (req, res) => {
  const body = req.body as {
    jobId: number;
    inspectorId: number;
    logDate: string;
    hours: number;
    productiveHours: number;
    narrative?: string;
    qualityScore?: number;
  };

  try {
    await assertCanLogActivity(body.jobId, body.inspectorId, req.user!);
  } catch (err) {
    sendRouteError(res, err, 'Cannot log activity');
    return;
  }

  const log = await prisma.activityLog.create({
    data: {
      jobId: body.jobId,
      inspectorId: body.inspectorId,
      logDate: new Date(body.logDate + 'T12:00:00'),
      hours: body.hours,
      productiveHours: body.productiveHours,
      narrative: body.narrative,
      qualityScore: body.qualityScore,
    },
    include: logInclude,
  });
  await recordAudit({
    userId: req.user!.id,
    action: 'activityLog.created',
    entityType: 'ActivityLog',
    entityId: log.id,
    payload: { jobId: log.jobId, inspectorId: log.inspectorId, hours: log.hours, logDate: log.logDate },
  });
  res.status(201).json(log);
});

router.post('/batch', validateBody(createActivityLogBatchSchema), async (req, res) => {
  const body = req.body as {
    jobId: number;
    inspectorId: number;
    entries: {
      logDate: string;
      hours: number;
      productiveHours: number;
      narrative?: string | null;
      qualityScore?: number;
    }[];
  };

  try {
    await assertCanLogActivity(body.jobId, body.inspectorId, req.user!);
  } catch (err) {
    sendRouteError(res, err, 'Cannot log activity');
    return;
  }

  const existing = await prisma.activityLog.findMany({
    where: { jobId: body.jobId, inspectorId: body.inspectorId },
    select: { logDate: true },
  });
  const existingKeys = new Set(existing.map((e) => dateKey(e.logDate)));

  const created = [];
  const skipped: string[] = [];

  for (const entry of body.entries) {
    if (entry.hours <= 0 && entry.productiveHours <= 0) {
      skipped.push(entry.logDate);
      continue;
    }
    if (existingKeys.has(entry.logDate)) {
      skipped.push(entry.logDate);
      continue;
    }
    const log = await prisma.activityLog.create({
      data: {
        jobId: body.jobId,
        inspectorId: body.inspectorId,
        logDate: new Date(entry.logDate + 'T12:00:00'),
        hours: entry.hours,
        productiveHours: entry.productiveHours,
        narrative: entry.narrative || null,
        qualityScore: entry.qualityScore,
      },
      include: logInclude,
    });
    existingKeys.add(entry.logDate);
    created.push(log);
  }

  await recordAudit({
    userId: req.user!.id,
    action: 'activityLog.batchCreated',
    entityType: 'Job',
    entityId: body.jobId,
    payload: {
      inspectorId: body.inspectorId,
      created: created.length,
      skipped: skipped.length,
      skippedDates: skipped,
    },
  });

  res.status(201).json({ created, skipped });
});

router.get('/', async (req, res) => {
  const jobId = req.query.jobId ? Number(req.query.jobId) : undefined;
  const inspectorId = req.query.inspectorId ? Number(req.query.inspectorId) : undefined;

  let scopedInspectorId = inspectorId;
  if (req.user!.role === 'Inspector') {
    const inspector = await getInspectorForUser(req.user!);
    if (!inspector) {
      res.json([]);
      return;
    }
    if (inspectorId && inspectorId !== inspector.id) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    scopedInspectorId = inspector.id;
  }

  const logs = await prisma.activityLog.findMany({
    where: {
      ...(jobId ? { jobId } : {}),
      ...(scopedInspectorId ? { inspectorId: scopedInspectorId } : {}),
    },
    include: logInclude,
    orderBy: { logDate: 'desc' },
    take: 100,
  });
  res.json(logs);
});

router.put('/:id', validateBody(updateActivityLogSchema), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.activityLog.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const allowed = await canEditLog(req.user!, existing);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  const body = req.body as {
    logDate?: string;
    hours?: number;
    productiveHours?: number;
    narrative?: string;
    qualityScore?: number;
  };

  const log = await prisma.activityLog.update({
    where: { id },
    data: {
      logDate: body.logDate ? new Date(body.logDate) : undefined,
      hours: body.hours,
      productiveHours: body.productiveHours,
      narrative: body.narrative,
      qualityScore: body.qualityScore,
    },
    include: logInclude,
  });
  await recordAudit({
    userId: req.user!.id,
    action: 'activityLog.updated',
    entityType: 'ActivityLog',
    entityId: log.id,
    payload: { jobId: log.jobId, hours: log.hours, logDate: log.logDate },
  });
  res.json(log);
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.activityLog.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const allowed = await canEditLog(req.user!, existing);
  if (!allowed) {
    res.status(403).json({ error: 'Forbidden' });
    return;
  }

  await prisma.activityLog.delete({ where: { id } });
  await recordAudit({
    userId: req.user!.id,
    action: 'activityLog.deleted',
    entityType: 'ActivityLog',
    entityId: id,
    payload: { jobId: existing.jobId, inspectorId: existing.inspectorId },
  });
  res.json({ ok: true });
});

export default router;
