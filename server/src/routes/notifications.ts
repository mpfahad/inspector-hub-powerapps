import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware } from '../middleware/auth.js';

const router = Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const email = req.user!.email;
  const [items, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: { userEmail: email },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.notification.count({ where: { userEmail: email, read: false } }),
  ]);
  res.json({ items, unreadCount });
});

router.post('/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  const note = await prisma.notification.findFirst({
    where: { id, userEmail: req.user!.email },
  });
  if (!note) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const updated = await prisma.notification.update({ where: { id }, data: { read: true } });
  res.json(updated);
});

router.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({
    where: { userEmail: req.user!.email, read: false },
    data: { read: true },
  });
  res.json({ ok: true });
});

export default router;
