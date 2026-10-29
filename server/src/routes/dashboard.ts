import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  capacitySummary,
  dayLoad,
  isoDate,
  mondayOfWeek,
  rangeDays,
  type PlannerAllocation,
} from '../services/plannerService.js';
import { STANDARD_DAY_HOURS } from '../services/plannerService.js';
import { expiresOnCutoffForExpiring } from '../lib/certStatus.js';
import { getInspectorForUser, STAFF_ROLES } from '../services/authz.js';

const router = Router();
router.use(authMiddleware);

const assignmentInclude = {
  job: { include: { client: true, department: true, jobType: true } },
  inspector: true,
};

router.get('/kpis', requireRole(...STAFF_ROLES), async (_req, res) => {
  const [openJobs, activeInspectors, activeJobs] = await Promise.all([
    prisma.job.count({ where: { status: { notIn: ['Closed', 'Cancelled', 'Draft', 'Completed'] } } }),
    prisma.inspector.count({ where: { status: 'Active' } }),
    prisma.job.count({ where: { status: 'Active' } }),
  ]);
  res.json({ openJobs, activeInspectors, activeJobs });
});

router.get('/operations', requireRole(...STAFF_ROLES), async (_req, res) => {
  const weekStart = mondayOfWeek(new Date());
  const dayDates = rangeDays(weekStart, 7);
  const isoDays = dayDates.map(isoDate);

  const [
    openJobs,
    activeInspectors,
    activeJobsCount,
    expiringCerts,
    inspectors,
    assignments,
    leaveRecords,
    departments,
    upcomingJobs,
    recentActivity,
  ] = await Promise.all([
    prisma.job.count({ where: { status: { notIn: ['Closed', 'Cancelled', 'Draft', 'Completed'] } } }),
    prisma.inspector.count({ where: { status: 'Active' } }),
    prisma.job.count({ where: { status: 'Active' } }),
    prisma.inspectorCert.count({
      where: { expiresOn: { lte: expiresOnCutoffForExpiring() } },
    }),
    prisma.inspector.findMany({
      where: { status: { not: 'Inactive' } },
      include: { department: true },
    }),
    prisma.assignment.findMany({
      where: {
        status: { in: ['PendingAcceptance', 'Accepted', 'Active'] },
        job: { status: { notIn: ['Cancelled', 'Closed', 'Completed'] } },
      },
      include: { job: true },
    }),
    prisma.leaveRequest.findMany({ where: { status: 'Approved' } }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
    prisma.job.findMany({
      where: { status: { in: ['Active', 'PendingAcceptance', 'Proposed'] } },
      include: { client: true, department: true, assignments: { where: { status: { notIn: ['Cancelled', 'Rejected'] } } } },
      orderBy: { startDate: 'asc' },
      take: 6,
    }),
    prisma.activityLog.findMany({
      include: { inspector: true, job: { include: { client: true } } },
      orderBy: { logDate: 'desc' },
      take: 8,
    }),
  ]);

  const allocations: PlannerAllocation[] = [];
  for (const a of assignments) {
    allocations.push({
      id: `job-${a.id}`,
      inspectorId: a.inspectorId,
      kind: 'job',
      title: a.job.title,
      ref: a.job.ref,
      start: isoDate(a.job.startDate),
      end: isoDate(a.job.endDate),
      hoursPerDay: STANDARD_DAY_HOURS,
      jobId: a.job.id,
    });
  }
  for (const l of leaveRecords) {
    allocations.push({
      id: `leave-${l.id}`,
      inspectorId: l.inspectorId,
      kind: l.type.toLowerCase().includes('training') ? 'training' : 'leave',
      title: l.type,
      start: isoDate(l.startDate),
      end: isoDate(l.endDate),
      hoursPerDay: STANDARD_DAY_HOURS,
    });
  }

  const capacity = capacitySummary(inspectors, isoDays, allocations);

  const utilizationSeries = isoDays.map((iso) => {
    let hours = 0;
    for (const ins of inspectors) {
      hours += dayLoad(allocations, ins.id, iso).hours;
    }
    const maxCapacity = inspectors.length * STANDARD_DAY_HOURS;
    const value = maxCapacity ? Math.round((hours / maxCapacity) * 100) : 0;
    const day = new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
    return { day, value };
  });

  const deptLoad = await Promise.all(
    departments.map(async (dept) => {
      const [inspectorCount, deptAssignments] = await Promise.all([
        prisma.inspector.count({ where: { departmentId: dept.id, status: { not: 'Inactive' } } }),
        prisma.assignment.findMany({
          where: {
            status: { in: ['PendingAcceptance', 'Accepted', 'Active'] },
            job: { departmentId: dept.id, status: { notIn: ['Closed', 'Cancelled', 'Completed'] } },
          },
          select: { allocatedHours: true },
        }),
      ]);
      const allocated = deptAssignments.reduce((s, a) => s + a.allocatedHours, 0);
      const load = inspectorCount
        ? Math.min(100, Math.round((allocated / (inspectorCount * 40)) * 100))
        : 0;
      return { dept: dept.name.replace(' Inspection', ''), load };
    })
  );

  const actionItems: { type: string; title: string; detail: string; link?: string }[] = [];
  if (expiringCerts > 0) {
    actionItems.push({
      type: 'CERT',
      title: `${expiringCerts} certifications expiring or expired`,
      detail: 'May block assignment engine',
      link: '/competency',
    });
  }

  res.json({
    kpis: {
      openJobs,
      activeInspectors,
      activeJobs: activeJobsCount,
      expiringCerts,
      utilization: capacity.utilization,
    },
    utilizationSeries,
    deptLoad,
    upcomingJobs: upcomingJobs.map((j) => ({
      id: j.id,
      ref: j.ref,
      title: j.title,
      client: j.client.name,
      department: j.department.name,
      startDate: j.startDate.toISOString().slice(0, 10),
      endDate: j.endDate.toISOString().slice(0, 10),
      status: j.status,
      assigned: j.assignments.length,
      required: j.requiredInspectorCount,
    })),
    recentActivity: recentActivity.map((l) => ({
      id: l.id,
      jobRef: l.job.ref,
      jobTitle: l.job.title,
      inspector: l.inspector.name,
      logDate: l.logDate.toISOString().slice(0, 10),
      hours: l.hours,
      narrative: l.narrative,
    })),
    actionItems,
  });
});

router.get('/inspector', requireRole('Inspector'), async (req, res) => {
  const inspector = await getInspectorForUser(req.user!);
  if (!inspector) {
    res.json({
      counts: { activeJobs: 0, completedJobs: 0 },
      activeJobs: [],
    });
    return;
  }

  const [activeJobs, completedCount, recentCompleted] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        inspectorId: inspector.id,
        status: { in: ['Accepted', 'Active', 'PendingAcceptance'] },
        job: { status: { in: ['Active', 'PendingAcceptance'] } },
      },
      include: assignmentInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.assignment.count({
      where: {
        inspectorId: inspector.id,
        status: { in: ['Complete', 'Accepted', 'Active'] },
        job: { status: { in: ['Completed', 'Closed'] } },
      },
    }),
    prisma.assignment.findMany({
      where: {
        inspectorId: inspector.id,
        status: { in: ['Complete', 'Accepted', 'Active'] },
        job: { status: { in: ['Completed', 'Closed'] } },
      },
      include: assignmentInclude,
      orderBy: { job: { completedAt: 'desc' } },
      take: 5,
    }),
  ]);

  res.json({
    counts: {
      activeJobs: activeJobs.length,
      completedJobs: completedCount,
    },
    activeJobs,
    recentCompleted,
  });
});

export default router;
