import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES } from '../services/authz.js';
import { validateBody } from '../lib/validate.js';
import { priceChartSchema } from '../lib/schemas.js';
import { getPriceChart } from '../services/pricing.js';
import { recordAudit } from '../services/audit.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(...STAFF_ROLES));

router.get('/', async (_req, res) => {
  res.json(await getPriceChart());
});

router.put('/', validateBody(priceChartSchema), async (req, res) => {
  const body = req.body as {
    globalDefaultUsd?: number;
    items?: { jobTypeId: number; priceUsd: number }[];
  };

  if (body.globalDefaultUsd != null) {
    const existing = await prisma.priceChart.findFirst({ where: { jobTypeId: null } });
    if (existing) {
      await prisma.priceChart.update({
        where: { id: existing.id },
        data: { priceUsd: body.globalDefaultUsd, updatedByEmail: req.user?.email },
      });
    } else {
      await prisma.priceChart.create({
        data: { jobTypeId: null, priceUsd: body.globalDefaultUsd, updatedByEmail: req.user?.email },
      });
    }
  }

  if (body.items) {
    for (const item of body.items) {
      await prisma.jobType.update({
        where: { id: item.jobTypeId },
        data: { defaultPriceUsd: item.priceUsd },
      });
      await prisma.priceChart.upsert({
        where: { jobTypeId: item.jobTypeId },
        create: { jobTypeId: item.jobTypeId, priceUsd: item.priceUsd, updatedByEmail: req.user?.email },
        update: { priceUsd: item.priceUsd, updatedByEmail: req.user?.email },
      });
    }
  }

  await recordAudit({
    userId: req.user?.id,
    action: 'priceChart.updated',
    entityType: 'PriceChart',
    payload: body,
  });

  res.json(await getPriceChart());
});

export default router;
