import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import {
  bulkImportJobTypesSchema,
  createJobTypeSchema,
  updateJobTypeSchema,
} from '../lib/schemas.js';
import { recordAudit } from '../services/audit.js';
import {
  assertCanAccessDepartment,
  STAFF_ROLES,
  staffDepartmentWhere,
} from '../services/authz.js';
import { sendRouteError } from '../lib/httpErrors.js';
import { syncJobTypeRates } from '../services/jobTypeRates.js';

const router = Router();
router.use(authMiddleware);

const OPEN_JOB_STATUSES = ['Draft', 'Proposed', 'PendingAcceptance', 'Active', 'Completed'] as const;

const include = {
  department: true,
  certRequirements: { include: { certification: true } },
  _count: { select: { jobs: true } },
};

function deptFilter(req: { query: Record<string, unknown> }) {
  const raw = req.query.departmentId ?? req.query.departmentCode;
  if (raw == null || raw === '') return undefined;
  if (typeof raw === 'string' && /^\d+$/.test(raw)) {
    return { departmentId: Number(raw) };
  }
  if (typeof raw === 'string') {
    return { department: { code: raw.toUpperCase() } };
  }
  return undefined;
}

router.get('/', async (req, res) => {
  const where = {
    active: true,
    ...deptFilter(req),
    ...staffDepartmentWhere(req.user!),
  };
  const types = await prisma.jobType.findMany({
    where,
    include,
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.get('/all', requireRole('Coordinator', 'Manager', 'Admin'), async (req, res) => {
  const types = await prisma.jobType.findMany({
    where: { ...deptFilter(req), ...staffDepartmentWhere(req.user!) },
    include,
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.post(
  '/bulk-import',
  requireRole(...STAFF_ROLES),
  validateBody(bulkImportJobTypesSchema),
  async (req, res) => {
    const body = req.body as {
      departmentId: number;
      jobTypes: {
        code: string;
        name: string;
        description?: string | null;
        dayRateUsd?: number | null;
        defaultHours?: number | null;
        active?: boolean;
        requiredCertCodes?: string | null;
      }[];
    };

    const dept = await prisma.department.findUnique({ where: { id: body.departmentId } });
    if (!dept) {
      res.status(400).json({ error: 'Department not found' });
      return;
    }
    try {
      assertCanAccessDepartment(req.user!, body.departmentId);
    } catch (err) {
      sendRouteError(res, err, 'Forbidden');
      return;
    }

    const created: string[] = [];
    const updated: string[] = [];
    const errors: { code: string; error: string }[] = [];

    for (const row of body.jobTypes) {
      const code = row.code.trim().toUpperCase();
      try {
        const rates = syncJobTypeRates({
          dayRateUsd: row.dayRateUsd,
          defaultHours: row.defaultHours ?? 8,
        });
        const certCodes = (row.requiredCertCodes ?? '')
          .split(/[|;,]/)
          .map((c) => c.trim().toUpperCase())
          .filter(Boolean);
        const certIds: number[] = [];
        for (const certCode of certCodes) {
          const cert = await prisma.certification.upsert({
            where: { code: certCode },
            create: { code: certCode, name: certCode, validityMonths: 60 },
            update: {},
          });
          certIds.push(cert.id);
        }

        const existing = await prisma.jobType.findFirst({
          where: { departmentId: body.departmentId, code },
        });

        if (!existing) {
          const type = await prisma.jobType.create({
            data: {
              departmentId: body.departmentId,
              code,
              name: row.name.trim(),
              description: row.description?.trim() || null,
              active: row.active ?? true,
              defaultPriceUsd: rates.defaultPriceUsd,
              dayRateUsd: rates.dayRateUsd,
              hourRateUsd: rates.hourRateUsd,
              defaultHours: rates.defaultHours,
              certRequirements: certIds.length
                ? { create: certIds.map((certificationId) => ({ certificationId, mandatory: true })) }
                : undefined,
            },
          });
          created.push(type.code);
        } else {
          await prisma.jobTypeCertRequirement.deleteMany({ where: { jobTypeId: existing.id } });
          await prisma.jobType.update({
            where: { id: existing.id },
            data: {
              name: row.name.trim(),
              description: row.description?.trim() || null,
              active: row.active ?? true,
              defaultPriceUsd: rates.defaultPriceUsd,
              dayRateUsd: rates.dayRateUsd,
              hourRateUsd: rates.hourRateUsd,
              defaultHours: rates.defaultHours,
              certRequirements: certIds.length
                ? { create: certIds.map((certificationId) => ({ certificationId, mandatory: true })) }
                : undefined,
            },
          });
          updated.push(code);
        }
      } catch (err) {
        errors.push({ code, error: err instanceof Error ? err.message : 'Could not save' });
      }
    }

    await recordAudit({
      userId: req.user?.id,
      action: 'jobType.bulk_import',
      entityType: 'JobType',
      payload: {
        departmentId: body.departmentId,
        created: created.length,
        updated: updated.length,
        errors: errors.length,
      },
    });

    res.json({ created, updated, errors });
  }
);

router.get('/:id', async (req, res) => {
  const type = await prisma.jobType.findUnique({
    where: { id: Number(req.params.id) },
    include,
  });
  if (!type) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  res.json(type);
});

router.post('/', requireRole(...STAFF_ROLES), validateBody(createJobTypeSchema), async (req, res) => {
  const body = req.body as {
    departmentId: number;
    code: string;
    name: string;
    description?: string | null;
    certificationIds?: number[];
    defaultPriceUsd?: number | null;
    dayRateUsd?: number | null;
    hourRateUsd?: number | null;
    defaultHours?: number | null;
  };

  const dept = await prisma.department.findUnique({ where: { id: body.departmentId } });
  if (!dept) {
    res.status(400).json({ error: 'Department not found' });
    return;
  }
  try {
    assertCanAccessDepartment(req.user!, body.departmentId);
  } catch (err) {
    sendRouteError(res, err, 'Forbidden');
    return;
  }

  const rates = syncJobTypeRates(body);
  const type = await prisma.jobType.create({
    data: {
      departmentId: body.departmentId,
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      defaultPriceUsd: rates.defaultPriceUsd,
      dayRateUsd: rates.dayRateUsd,
      hourRateUsd: rates.hourRateUsd,
      defaultHours: rates.defaultHours,
      certRequirements: body.certificationIds?.length
        ? {
            create: body.certificationIds.map((certificationId) => ({
              certificationId,
              mandatory: true,
            })),
          }
        : undefined,
    },
    include,
  });
  res.status(201).json(type);
});

router.put('/:id', requireRole(...STAFF_ROLES), validateBody(updateJobTypeSchema), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    departmentId?: number;
    code?: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    certificationIds?: number[];
    defaultPriceUsd?: number | null;
    dayRateUsd?: number | null;
    hourRateUsd?: number | null;
    defaultHours?: number | null;
  };
  const existing = await prisma.jobType.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    assertCanAccessDepartment(req.user!, existing.departmentId);
    if (body.departmentId !== undefined) {
      assertCanAccessDepartment(req.user!, body.departmentId);
    }
  } catch (err) {
    sendRouteError(res, err, 'Forbidden');
    return;
  }

  if (body.certificationIds) {
    await prisma.jobTypeCertRequirement.deleteMany({ where: { jobTypeId: id } });
    if (body.certificationIds.length > 0) {
      await prisma.jobTypeCertRequirement.createMany({
        data: body.certificationIds.map((certificationId) => ({
          jobTypeId: id,
          certificationId,
          mandatory: true,
        })),
      });
    }
  }

  const rateTouched =
    body.dayRateUsd !== undefined ||
    body.hourRateUsd !== undefined ||
    body.defaultHours !== undefined ||
    body.defaultPriceUsd !== undefined;
  const rates = rateTouched
    ? syncJobTypeRates({
        dayRateUsd: body.dayRateUsd !== undefined ? body.dayRateUsd : existing.dayRateUsd,
        hourRateUsd: body.hourRateUsd !== undefined ? body.hourRateUsd : existing.hourRateUsd,
        defaultHours: body.defaultHours !== undefined ? body.defaultHours : existing.defaultHours,
        defaultPriceUsd:
          body.defaultPriceUsd !== undefined ? body.defaultPriceUsd : existing.defaultPriceUsd,
      })
    : null;

  const type = await prisma.jobType.update({
    where: { id },
    data: {
      departmentId: body.departmentId,
      code: body.code,
      name: body.name,
      description: body.description,
      active: body.active,
      ...(rates
        ? {
            defaultPriceUsd: rates.defaultPriceUsd,
            dayRateUsd: rates.dayRateUsd,
            hourRateUsd: rates.hourRateUsd,
            defaultHours: rates.defaultHours,
          }
        : {}),
    },
    include,
  });

  res.json(type);
});

router.delete('/:id', requireRole(...STAFF_ROLES), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const existing = await prisma.jobType.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  try {
    assertCanAccessDepartment(req.user!, existing.departmentId);
  } catch (err) {
    sendRouteError(res, err, 'Forbidden');
    return;
  }
  const openJobs = await prisma.job.count({
    where: { jobTypeId: id, status: { in: [...OPEN_JOB_STATUSES] } },
  });
  if (openJobs > 0) {
    res.status(409).json({
      error: `Cannot delete: ${openJobs} open job(s) still use this type. Close or cancel them first.`,
    });
    return;
  }
  await prisma.$transaction(async (tx) => {
    await tx.job.updateMany({ where: { jobTypeId: id }, data: { jobTypeId: null } });
    await tx.jobType.delete({ where: { id } });
  });
  await recordAudit({
    userId: req.user?.id,
    action: 'jobType.delete',
    entityType: 'JobType',
    entityId: id,
    payload: { code: existing.code, name: existing.name, departmentId: existing.departmentId },
  });
  res.json({ ok: true, id });
});

export default router;
