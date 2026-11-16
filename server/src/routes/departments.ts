import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES } from '../services/authz.js';
import {
  createDepartmentSchema,
  deleteDepartmentsSchema,
  updateDepartmentSchema,
} from '../lib/schemas.js';
import { validateBody } from '../lib/validate.js';
import { recordAudit } from '../services/audit.js';

async function departmentDeleteBlockers(id: number) {
  const [inspectors, jobs, jobTypes] = await Promise.all([
    prisma.inspector.count({ where: { departmentId: id } }),
    prisma.job.count({ where: { departmentId: id } }),
    prisma.jobType.count({ where: { departmentId: id } }),
  ]);
  const reasons: string[] = [];
  if (inspectors > 0) reasons.push(`${inspectors} inspector(s)`);
  if (jobs > 0) reasons.push(`${jobs} job(s)`);
  if (jobTypes > 0) reasons.push(`${jobTypes} job type(s)`);
  return reasons;
}

const router = Router();
router.use(authMiddleware);

function workloadPct(allocatedHours: number, inspectorCount: number) {
  if (inspectorCount === 0) return 0;
  const weeklyCapacity = inspectorCount * 40;
  return Math.min(100, Math.round((allocatedHours / weeklyCapacity) * 100));
}

router.get('/overview', requireRole(...STAFF_ROLES), async (req, res) => {
  const allowed = req.user?.departmentIds ?? [];
  const departments = await prisma.department.findMany({
    where: allowed.length > 0 ? { id: { in: allowed } } : undefined,
    orderBy: { name: 'asc' },
  });

  const rows = await Promise.all(
    departments.map(async (dept) => {
      const [inspectorCount, activeJobs, openJobs, assignments] = await Promise.all([
        prisma.inspector.count({ where: { departmentId: dept.id, status: { not: 'Inactive' } } }),
        prisma.job.count({
          where: { departmentId: dept.id, status: { in: ['Active', 'PendingAcceptance'] } },
        }),
        prisma.job.count({
          where: { departmentId: dept.id, status: { notIn: ['Closed', 'Cancelled'] } },
        }),
        prisma.assignment.findMany({
          where: {
            status: { in: ['PendingAcceptance', 'Accepted', 'Active'] },
            job: { departmentId: dept.id, status: { notIn: ['Closed', 'Cancelled'] } },
          },
          select: { allocatedHours: true },
        }),
      ]);

      const allocatedHours = assignments.reduce((s, a) => s + a.allocatedHours, 0);

      return {
        id: dept.id,
        name: dept.name,
        code: dept.code,
        managerEmail: dept.managerEmail,
        inspectorCount,
        activeJobs,
        openJobs,
        workloadPct: workloadPct(allocatedHours, inspectorCount),
        allocatedHours,
      };
    })
  );

  res.json(rows);
});

router.post('/', requireRole('Admin'), validateBody(createDepartmentSchema), async (req, res) => {
  const body = req.body as { name: string; code: string; managerEmail?: string | null };
  const code = body.code.trim().toUpperCase();
  const clash = await prisma.department.findUnique({ where: { code } });
  if (clash) {
    res.status(409).json({ error: 'A department with this code already exists' });
    return;
  }
  const created = await prisma.department.create({
    data: {
      name: body.name.trim(),
      code,
      managerEmail: body.managerEmail?.trim() || null,
    },
  });
  await recordAudit({
    userId: req.user?.id,
    action: 'department.create',
    entityType: 'Department',
    entityId: created.id,
    payload: { code: created.code, name: created.name },
  });
  res.status(201).json(created);
});

router.put('/:id', requireRole('Admin'), validateBody(updateDepartmentSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const body = req.body as { name?: string; code?: string; managerEmail?: string | null };
  const data: { name?: string; code?: string; managerEmail?: string | null } = {};
  if (body.name !== undefined) data.name = body.name.trim();
  if (body.code !== undefined) {
    const code = body.code.trim().toUpperCase();
    if (code !== existing.code) {
      const clash = await prisma.department.findUnique({ where: { code } });
      if (clash) {
        res.status(409).json({ error: 'A department with this code already exists' });
        return;
      }
    }
    data.code = code;
  }
  if (body.managerEmail !== undefined) {
    data.managerEmail = body.managerEmail?.trim() || null;
  }
  const updated = await prisma.department.update({ where: { id }, data });
  await recordAudit({
    userId: req.user?.id,
    action: 'department.update',
    entityType: 'Department',
    entityId: updated.id,
    payload: data,
  });
  res.json(updated);
});

router.post('/bulk-delete', requireRole('Admin'), validateBody(deleteDepartmentsSchema), async (req, res) => {
  const { departmentIds } = req.body as { departmentIds: number[] };
  const deleted: { id: number; code: string; name: string }[] = [];
  const errors: { id: number; error: string }[] = [];

  for (const id of departmentIds) {
    const existing = await prisma.department.findUnique({ where: { id } });
    if (!existing) {
      errors.push({ id, error: 'Not found' });
      continue;
    }
    if (existing.code.toUpperCase() === 'HOLD') {
      errors.push({ id, error: 'The HOLD department cannot be deleted' });
      continue;
    }
    const blockers = await departmentDeleteBlockers(id);
    if (blockers.length > 0) {
      errors.push({
        id,
        error: `Cannot delete ${existing.code}: still has ${blockers.join(', ')}`,
      });
      continue;
    }
    await prisma.department.delete({ where: { id } });
    deleted.push({ id: existing.id, code: existing.code, name: existing.name });
  }

  if (deleted.length > 0) {
    await recordAudit({
      userId: req.user?.id,
      action: 'department.bulk_delete',
      entityType: 'Department',
      payload: { deleted, errors },
    });
  }

  res.json({ deleted, errors });
});

router.delete('/:id', requireRole('Admin'), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const existing = await prisma.department.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  if (existing.code.toUpperCase() === 'HOLD') {
    res.status(409).json({ error: 'The HOLD department cannot be deleted' });
    return;
  }
  const blockers = await departmentDeleteBlockers(id);
  if (blockers.length > 0) {
    res.status(409).json({
      error: `Cannot delete ${existing.code}: still has ${blockers.join(', ')}`,
    });
    return;
  }
  await prisma.department.delete({ where: { id } });
  await recordAudit({
    userId: req.user?.id,
    action: 'department.delete',
    entityType: 'Department',
    entityId: id,
    payload: { code: existing.code, name: existing.name },
  });
  res.status(204).send();
});

export default router;
