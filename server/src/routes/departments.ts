import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES } from '../services/authz.js';

const router = Router();
router.use(authMiddleware);

function workloadPct(allocatedHours: number, inspectorCount: number) {
  if (inspectorCount === 0) return 0;
  const weeklyCapacity = inspectorCount * 40;
  return Math.min(100, Math.round((allocatedHours / weeklyCapacity) * 100));
}

router.get('/overview', requireRole(...STAFF_ROLES), async (_req, res) => {
  const departments = await prisma.department.findMany({ orderBy: { name: 'asc' } });

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

export default router;
