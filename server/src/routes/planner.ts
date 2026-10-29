import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  capacitySummary,
  dayLoad,
  daySpan,
  detectConflicts,
  isoDate,
  mondayOfWeek,
  rangeDays,
  rollingUtilization,
  STANDARD_DAY_HOURS,
  type PlannerAllocation,
} from '../services/plannerService.js';
import { STAFF_ROLES } from '../services/authz.js';

const router = Router();
router.use(authMiddleware);

const VIEW_DAYS: Record<string, number> = { day: 1, week: 7, month: 28 };

function leaveKind(type: string): 'leave' | 'training' {
  return type.toLowerCase().includes('training') ? 'training' : 'leave';
}

router.get('/', requireRole(...STAFF_ROLES), async (req, res) => {
  const weekStartParam = req.query.weekStart as string | undefined;
  const view = (req.query.view as string) ?? 'week';
  const department = req.query.department as string | undefined;
  const dayCount = VIEW_DAYS[view] ?? 7;

  const base = weekStartParam ? new Date(weekStartParam + 'T12:00:00') : new Date();
  const anchor = view === 'week' && !weekStartParam ? mondayOfWeek(base) : new Date(base);
  anchor.setHours(0, 0, 0, 0);

  const dayDates = rangeDays(anchor, dayCount);
  const isoDays = dayDates.map(isoDate);
  const windowStart = isoDays[0];
  const windowEnd = isoDays[isoDays.length - 1];

  const [inspectors, assignments, leaveRecords, departments] = await Promise.all([
    prisma.inspector.findMany({
      where: {
        status: { not: 'Inactive' },
        ...(department && department !== 'All' ? { department: { name: department } } : {}),
      },
      include: { department: true },
      orderBy: { name: 'asc' },
    }),
    prisma.assignment.findMany({
      where: {
        status: { in: ['PendingAcceptance', 'Accepted', 'Active'] },
        job: { status: { notIn: ['Cancelled', 'Closed'] } },
      },
      include: {
        job: { include: { client: true } },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'Approved' },
    }),
    prisma.department.findMany({ orderBy: { name: 'asc' } }),
  ]);

  const allocations: PlannerAllocation[] = [];

  for (const a of assignments) {
    const start = isoDate(a.job.startDate);
    const end = isoDate(a.job.endDate);
    if (end < windowStart || start > windowEnd) continue;

    const span = daySpan(a.job.startDate, a.job.endDate);
    const hoursPerDay = Math.min(
      STANDARD_DAY_HOURS,
      Math.round((a.allocatedHours / span) * 10) / 10
    );

    allocations.push({
      id: `job-${a.id}`,
      inspectorId: a.inspectorId,
      kind: 'job',
      title: a.job.title,
      ref: a.job.ref,
      start,
      end,
      hoursPerDay: hoursPerDay || STANDARD_DAY_HOURS,
      location: a.job.location ?? undefined,
      priority: a.job.priority,
      jobId: a.job.id,
    });
  }

  for (const l of leaveRecords) {
    const start = isoDate(l.startDate);
    const end = isoDate(l.endDate);
    if (end < windowStart || start > windowEnd) continue;

    allocations.push({
      id: `leave-${l.id}`,
      inspectorId: l.inspectorId,
      kind: leaveKind(l.type),
      title: l.type,
      start,
      end,
      hoursPerDay: STANDARD_DAY_HOURS,
    });
  }

  const capacity = capacitySummary(inspectors, isoDays, allocations);
  const conflicts = detectConflicts(inspectors, allocations);

  const rows = inspectors.map((inspector) => ({
    id: inspector.id,
    name: inspector.name,
    employeeNo: inspector.employeeNo,
    department: inspector.department.name,
    status: inspector.status,
    utilization: rollingUtilization(allocations, inspector.id, isoDays),
    weeklyCapacityHrs: inspector.weeklyCapacityHrs,
    allocations: allocations.filter((a) => a.inspectorId === inspector.id),
    dayBands: isoDays.map((date) => {
      const load = dayLoad(allocations, inspector.id, date);
      return { date, band: load.band, hours: load.hours };
    }),
  }));

  res.json({
    view,
    anchor: isoDate(anchor),
    weekStart: windowStart,
    weekEnd: windowEnd,
    days: isoDays,
    departments: ['All', ...departments.map((d) => d.name)],
    capacity,
    conflicts,
    inspectors: rows,
  });
});

export default router;
