import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES } from '../services/authz.js';
import { resolveCoords } from '../lib/geo.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(...STAFF_ROLES));

type MapStage = 'new' | 'active' | 'completed';

function stageForStatus(status: string): MapStage | null {
  if (status === 'Closed' || status === 'Completed') return 'completed';
  if (status === 'Active' || status === 'PendingAcceptance') return 'active';
  if (status === 'Draft' || status === 'Proposed') return 'new';
  return null;
}

router.get('/', async (_req, res) => {
  const [clients, jobs] = await Promise.all([
    prisma.client.findMany({
      include: {
        jobs: {
          where: { status: { notIn: ['Cancelled'] } },
          select: { id: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.job.findMany({
      where: { status: { notIn: ['Cancelled'] } },
      include: { client: true },
      orderBy: { startDate: 'desc' },
    }),
  ]);

  const mappedJobs = jobs
    .map((j) => {
      const stage = stageForStatus(j.status);
      if (!stage) return null;
      const coords = resolveCoords(j, j.client);
      const latitude = coords?.lat ?? j.latitude ?? j.client.latitude ?? null;
      const longitude = coords?.lng ?? j.longitude ?? j.client.longitude ?? null;
      if (latitude == null || longitude == null) return null;
      return {
        id: j.id,
        ref: j.ref,
        title: j.title,
        status: j.status,
        stage,
        location: j.location ?? j.client.location,
        clientId: j.clientId,
        clientName: j.client.name,
        latitude,
        longitude,
      };
    })
    .filter((j): j is NonNullable<typeof j> => j != null);

  const mappedClients = clients
    .map((c) => {
      const coords = resolveCoords(c);
      const latitude = coords?.lat ?? c.latitude;
      const longitude = coords?.lng ?? c.longitude;
      if (latitude == null || longitude == null) return null;

      const counts = { new: 0, active: 0, completed: 0 };
      for (const j of c.jobs) {
        const stage = stageForStatus(j.status);
        if (stage) counts[stage] += 1;
      }
      const openJobCount = counts.new + counts.active;
      const primaryStage: MapStage | null =
        counts.active > 0 ? 'active' : counts.new > 0 ? 'new' : counts.completed > 0 ? 'completed' : null;

      return {
        id: c.id,
        name: c.name,
        location: c.location,
        latitude,
        longitude,
        openJobCount,
        counts,
        primaryStage,
      };
    })
    .filter((c): c is NonNullable<typeof c> => c != null);

  res.json({
    clients: mappedClients,
    jobs: mappedJobs,
  });
});

export default router;
