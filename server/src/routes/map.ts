import { Router } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  assertCanAccessDepartment,
  STAFF_ROLES,
  staffDepartmentWhere,
} from '../services/authz.js';
import { resolveCoords } from '../lib/geo.js';
import { sendRouteError } from '../lib/httpErrors.js';

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

function parseDepartmentId(query: { departmentId?: string }) {
  if (!query.departmentId) return undefined;
  const id = Number(query.departmentId);
  return Number.isFinite(id) ? id : undefined;
}

router.get('/', async (req, res) => {
  const departmentId = parseDepartmentId(req.query as { departmentId?: string });
  if (departmentId) {
    try {
      assertCanAccessDepartment(req.user!, departmentId);
    } catch (err) {
      sendRouteError(res, err, 'Forbidden');
      return;
    }
  }
  const jobWhere: Prisma.JobWhereInput = {
    status: { notIn: ['Cancelled'] },
    ...(departmentId ? { departmentId } : staffDepartmentWhere(req.user!)),
  };

  const [clients, jobs] = await Promise.all([
    prisma.client.findMany({
      include: {
        jobs: {
          where: jobWhere,
          select: { id: true, status: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.job.findMany({
      where: jobWhere,
      include: {
        client: true,
        assignments: {
          where: { status: { in: ['Accepted', 'Active', 'PendingAcceptance', 'Proposed'] } },
          include: { inspector: { select: { id: true, name: true, employeeNo: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
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
        departmentId: j.departmentId,
        latitude,
        longitude,
        inspectors: j.assignments.map((a) => ({
          id: a.inspector.id,
          name: a.inspector.name,
          employeeNo: a.inspector.employeeNo,
        })),
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
      // When scoped to a department, only show clients that have jobs in that dept
      if (departmentId && openJobCount + counts.completed === 0) return null;

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
