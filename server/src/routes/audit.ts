import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('Coordinator', 'Manager', 'Admin'));

router.get('/', async (req, res) => {
  const entityType = req.query.entityType as string | undefined;
  const entityId = req.query.entityId ? Number(req.query.entityId) : undefined;
  const limit = Math.min(Number(req.query.limit ?? 50), 200);

  const events = await prisma.auditEvent.findMany({
    where: {
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
    },
    include: { user: { select: { email: true, fullName: true, role: true } } },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });

  res.json(
    events.map((e) => ({
      id: e.id,
      action: e.action,
      entityType: e.entityType,
      entityId: e.entityId,
      payload: e.payload ? JSON.parse(e.payload) : null,
      createdAt: e.createdAt,
      user: e.user ? { email: e.user.email, fullName: e.user.fullName, role: e.user.role } : null,
    }))
  );
});

export default router;
