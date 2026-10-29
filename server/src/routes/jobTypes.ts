import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { validateBody } from '../lib/validate.js';
import { createJobTypeSchema, updateJobTypeSchema } from '../lib/schemas.js';

const router = Router();
router.use(authMiddleware);

const include = {
  certRequirements: { include: { certification: true } },
  _count: { select: { jobs: true } },
};

router.get('/', async (_req, res) => {
  const types = await prisma.jobType.findMany({
    where: { active: true },
    include,
    orderBy: { name: 'asc' },
  });
  res.json(types);
});

router.get('/all', requireRole('Coordinator', 'Manager', 'Admin'), async (_req, res) => {
  const types = await prisma.jobType.findMany({ include, orderBy: { name: 'asc' } });
  res.json(types);
});

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

router.post('/', requireRole('Coordinator', 'Manager', 'Admin'), validateBody(createJobTypeSchema), async (req, res) => {
  const body = req.body as {
    code: string;
    name: string;
    description?: string | null;
    certificationIds?: number[];
    defaultPriceUsd?: number | null;
  };

  const type = await prisma.jobType.create({
    data: {
      code: body.code,
      name: body.name,
      description: body.description ?? null,
      defaultPriceUsd: body.defaultPriceUsd ?? null,
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
  if (body.defaultPriceUsd != null) {
    await prisma.priceChart.create({
      data: { jobTypeId: type.id, priceUsd: body.defaultPriceUsd },
    });
  }
  res.status(201).json(type);
});

router.put('/:id', requireRole('Coordinator', 'Manager', 'Admin'), validateBody(updateJobTypeSchema), async (req, res) => {
  const id = Number(req.params.id);
  const body = req.body as {
    code?: string;
    name?: string;
    description?: string | null;
    active?: boolean;
    certificationIds?: number[];
    defaultPriceUsd?: number | null;
  };

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

  const type = await prisma.jobType.update({
    where: { id },
    data: {
      code: body.code,
      name: body.name,
      description: body.description,
      active: body.active,
      defaultPriceUsd: body.defaultPriceUsd !== undefined ? body.defaultPriceUsd : undefined,
    },
    include,
  });

  if (body.defaultPriceUsd != null) {
    const existing = await prisma.priceChart.findUnique({ where: { jobTypeId: id } });
    if (existing) {
      await prisma.priceChart.update({ where: { id: existing.id }, data: { priceUsd: body.defaultPriceUsd } });
    } else {
      await prisma.priceChart.create({ data: { jobTypeId: id, priceUsd: body.defaultPriceUsd } });
    }
  }

  res.json(type);
});

export default router;
