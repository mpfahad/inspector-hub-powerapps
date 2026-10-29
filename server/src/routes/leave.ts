import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole, type AuthUser } from '../middleware/auth.js';
import { recordAudit } from '../services/audit.js';
import { getInspectorForUser, isStaff, STAFF_ROLES } from '../services/authz.js';
import { validateBody } from '../lib/validate.js';
import { createLeaveSchema, updateLeaveSchema } from '../lib/schemas.js';

const router = Router();
router.use(authMiddleware);

const leaveInclude = {
  inspector: { include: { department: true } },
};

function parseDates(startDate: string, endDate: string) {
  if (!startDate || !endDate) throw new Error('Start and end dates are required');
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (end < start) throw new Error('End date must be on or after start date');
  return { start, end };
}

async function resolveInspectorId(user: AuthUser, bodyInspectorId?: number) {
  if (isStaff(user.role)) {
    if (!bodyInspectorId) throw new Error('Inspector is required');
    const inspector = await prisma.inspector.findUnique({ where: { id: bodyInspectorId } });
    if (!inspector) throw new Error('Inspector not found');
    return inspector.id;
  }

  const inspector = await getInspectorForUser(user!);
  if (!inspector) throw new Error('No inspector profile linked to your account');
  if (bodyInspectorId && bodyInspectorId !== inspector.id) {
    throw new Error('You can only manage your own leave');
  }
  return inspector.id;
}

async function assertCanManageLeave(user: AuthUser, leave: { inspectorId: number }) {
  if (isStaff(user.role)) return;
  const inspector = await getInspectorForUser(user);
  if (!inspector || inspector.id !== leave.inspectorId) {
    throw new Error('You can only manage your own leave');
  }
}

router.get('/', async (req, res) => {
  const inspectorId = req.query.inspectorId ? Number(req.query.inspectorId) : undefined;

  if (isStaff(req.user!.role)) {
    const items = await prisma.leaveRequest.findMany({
      where: inspectorId ? { inspectorId } : undefined,
      include: leaveInclude,
      orderBy: { startDate: 'desc' },
    });
    res.json(items);
    return;
  }

  const inspector = await getInspectorForUser(req.user!);
  if (!inspector) {
    res.json([]);
    return;
  }

  const items = await prisma.leaveRequest.findMany({
    where: { inspectorId: inspector.id },
    include: leaveInclude,
    orderBy: { startDate: 'desc' },
  });
  res.json(items);
});

router.post('/', validateBody(createLeaveSchema), async (req, res) => {
  try {
    const { type, startDate, endDate, reason, inspectorId: bodyInspectorId } = req.body as {
      type: string;
      startDate: string;
      endDate: string;
      reason?: string;
      inspectorId?: number;
    };

    const inspectorId = await resolveInspectorId(req.user!, bodyInspectorId);
    const { start, end } = parseDates(startDate, endDate);
    const staffCreated = isStaff(req.user!.role);

    const leave = await prisma.leaveRequest.create({
      data: {
        inspectorId,
        type: type.trim(),
        startDate: start,
        endDate: end,
        reason: reason?.trim() || null,
        status: staffCreated ? 'Approved' : 'Pending',
        createdByEmail: req.user!.email,
        updatedByEmail: req.user!.email,
      },
      include: leaveInclude,
    });

    await recordAudit({
      userId: req.user!.id,
      action: 'leave.created',
      entityType: 'LeaveRequest',
      entityId: leave.id,
      payload: {
        inspectorId,
        inspectorName: leave.inspector.name,
        type: leave.type,
        status: leave.status,
        startDate: leave.startDate.toISOString().slice(0, 10),
        endDate: leave.endDate.toISOString().slice(0, 10),
      },
    });

    res.status(201).json(leave);
  } catch (err) {
    res.status(400).json({ error: err instanceof Error ? err.message : 'Could not create leave' });
  }
});

router.put('/:id', validateBody(updateLeaveSchema), async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { inspector: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await assertCanManageLeave(req.user!, existing);

    const { type, startDate, endDate, reason } = req.body as {
      type?: string;
      startDate?: string;
      endDate?: string;
      reason?: string;
    };

    const start = startDate ? new Date(startDate) : existing.startDate;
    const end = endDate ? new Date(endDate) : existing.endDate;
    if (end < start) {
      res.status(400).json({ error: 'End date must be on or after start date' });
      return;
    }

    const leave = await prisma.leaveRequest.update({
      where: { id },
      data: {
        type: type?.trim() ?? existing.type,
        startDate: start,
        endDate: end,
        reason: reason !== undefined ? reason.trim() || null : existing.reason,
        updatedByEmail: req.user!.email,
      },
      include: leaveInclude,
    });

    await recordAudit({
      userId: req.user!.id,
      action: 'leave.updated',
      entityType: 'LeaveRequest',
      entityId: leave.id,
      payload: {
        inspectorId: leave.inspectorId,
        inspectorName: leave.inspector.name,
        type: leave.type,
        startDate: leave.startDate.toISOString().slice(0, 10),
        endDate: leave.endDate.toISOString().slice(0, 10),
      },
    });

    res.json(leave);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not update leave';
    res.status(err instanceof Error && message.includes('own leave') ? 403 : 400).json({ error: message });
  }
});

router.post('/:id/approve', requireRole(...STAFF_ROLES), async (req, res) => {
  const id = Number(req.params.id);
  const existing = await prisma.leaveRequest.findUnique({
    where: { id },
    include: leaveInclude,
  });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (existing.status !== 'Pending') {
    res.status(400).json({ error: 'Only pending leave can be approved' });
    return;
  }

  const leave = await prisma.leaveRequest.update({
    where: { id },
    data: { status: 'Approved', updatedByEmail: req.user!.email },
    include: leaveInclude,
  });

  await recordAudit({
    userId: req.user!.id,
    action: 'leave.approved',
    entityType: 'LeaveRequest',
    entityId: leave.id,
    payload: {
      inspectorId: leave.inspectorId,
      inspectorName: leave.inspector.name,
      type: leave.type,
    },
  });

  res.json(leave);
});

router.delete('/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.leaveRequest.findUnique({
      where: { id },
      include: { inspector: true },
    });
    if (!existing) {
      res.status(404).json({ error: 'Not found' });
      return;
    }

    await assertCanManageLeave(req.user!, existing);

    await prisma.leaveRequest.delete({ where: { id } });

    await recordAudit({
      userId: req.user!.id,
      action: 'leave.deleted',
      entityType: 'LeaveRequest',
      entityId: id,
      payload: {
        inspectorId: existing.inspectorId,
        inspectorName: existing.inspector.name,
        type: existing.type,
        startDate: existing.startDate.toISOString().slice(0, 10),
        endDate: existing.endDate.toISOString().slice(0, 10),
      },
    });

    res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not delete leave';
    res.status(err instanceof Error && message.includes('own leave') ? 403 : 400).json({ error: message });
  }
});

export default router;
