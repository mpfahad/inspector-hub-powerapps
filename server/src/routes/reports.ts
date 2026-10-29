import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  buildOverdueJobsReport,
  buildOverdueTrend,
  buildInspectorPerformanceReport,
  buildProductivityTrend,
  defaultReportPeriod,
} from '../services/inspectorPerformance.js';
import { expiresOnCutoffForExpiring } from '../lib/certStatus.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('Coordinator', 'Manager', 'Admin'));

function parsePeriod(query: { periodStart?: string; periodEnd?: string }) {
  if (query.periodStart && query.periodEnd) {
    return { periodStart: query.periodStart, periodEnd: query.periodEnd };
  }
  return defaultReportPeriod();
}

async function loadOverdueAssignments() {
  return prisma.assignment.findMany({
    where: { status: { notIn: ['Cancelled'] } },
    include: {
      inspector: {
        select: {
          id: true,
          name: true,
        },
      },
      job: {
        select: {
          id: true,
          ref: true,
          title: true,
          status: true,
          startDate: true,
          endDate: true,
          completedAt: true,
          client: {
            select: { name: true },
          },
          department: {
            select: { name: true },
          },
        },
      },
    },
  });
}

router.get('/inspector-performance', async (req, res) => {
  const { periodStart, periodEnd } = parsePeriod(req.query as { periodStart?: string; periodEnd?: string });

  const [inspectors, assignments, activityLogs, leaveRecords] = await Promise.all([
    prisma.inspector.findMany({
      where: { status: { not: 'Inactive' } },
      include: { department: true },
      orderBy: { name: 'asc' },
    }),
    prisma.assignment.findMany({
      where: { status: { notIn: ['Cancelled'] } },
      include: {
        job: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            completedAt: true,
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: {
        logDate: {
          gte: new Date(periodStart + 'T00:00:00'),
          lte: new Date(periodEnd + 'T23:59:59'),
        },
      },
      select: { inspectorId: true, logDate: true, hours: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'Approved' },
      select: { inspectorId: true, startDate: true, endDate: true, status: true },
    }),
  ]);

  const report = buildInspectorPerformanceReport({
    inspectors,
    assignments,
    activityLogs,
    leaveRecords,
    periodStart,
    periodEnd,
  });

  res.json(report);
});

router.get('/overdue-jobs', async (req, res) => {
  const { periodStart, periodEnd } = parsePeriod(req.query as { periodStart?: string; periodEnd?: string });
  const assignments = await loadOverdueAssignments();
  const overdueJobs = buildOverdueJobsReport({
    assignments,
    periodStart,
    periodEnd,
  });
  const trend = buildOverdueTrend({
    assignments,
    periodStart,
    periodEnd,
  });
  res.json({
    period: { start: periodStart, end: periodEnd },
    ...overdueJobs,
    trend,
  });
});

router.get('/summary', async (req, res) => {
  const { periodStart, periodEnd } = parsePeriod(req.query as { periodStart?: string; periodEnd?: string });

  const [operationsUtil, inspectors, assignments, activityLogs, leaveRecords, expiringCerts, overdueAssignments] =
    await Promise.all([
    prisma.inspector.count({ where: { status: 'Active' } }),
    prisma.inspector.findMany({
      where: { status: { not: 'Inactive' } },
      include: { department: true },
    }),
    prisma.assignment.findMany({
      where: { status: { notIn: ['Cancelled'] } },
      include: {
        job: {
          select: {
            id: true,
            status: true,
            startDate: true,
            endDate: true,
            completedAt: true,
          },
        },
      },
    }),
    prisma.activityLog.findMany({
      where: {
        logDate: {
          gte: new Date(periodStart + 'T00:00:00'),
          lte: new Date(periodEnd + 'T23:59:59'),
        },
      },
      select: { inspectorId: true, logDate: true, hours: true },
    }),
    prisma.leaveRequest.findMany({
      where: { status: 'Approved' },
      select: { inspectorId: true, startDate: true, endDate: true, status: true },
    }),
    prisma.inspectorCert.count({
      where: { expiresOn: { lte: expiresOnCutoffForExpiring() } },
    }),
    loadOverdueAssignments(),
  ]);

  const performance = buildInspectorPerformanceReport({
    inspectors,
    assignments,
    activityLogs,
    leaveRecords,
    periodStart,
    periodEnd,
  });
  const overdueJobs = buildOverdueJobsReport({
    assignments: overdueAssignments,
    periodStart,
    periodEnd,
  });
  const productivityTrend = buildProductivityTrend({
    inspectors,
    assignments,
    activityLogs,
    leaveRecords,
    periodStart,
    periodEnd,
  });

  res.json({
    period: performance.period,
    methodology: performance.methodology,
    scorecard: {
      utilization: performance.scorecard.avgUtilization,
      onTimeLogs: performance.scorecard.avgOnTime,
      compliance: expiringCerts === 0 ? 100 : Math.max(0, 100 - expiringCerts * 3),
      activeInspectors: operationsUtil,
      expiringCerts,
    },
    performance,
    overdueJobs,
    productivityTrend,
  });
});

router.get('/activity', async (req, res) => {
  const { periodStart, periodEnd } = parsePeriod(req.query as { periodStart?: string; periodEnd?: string });
  const logs = await prisma.activityLog.findMany({
    where: {
      logDate: {
        gte: new Date(periodStart + 'T00:00:00'),
        lte: new Date(periodEnd + 'T23:59:59'),
      },
    },
    include: {
      inspector: { select: { id: true, name: true, employeeNo: true } },
      job: {
        select: {
          id: true,
          ref: true,
          title: true,
          status: true,
          client: { select: { name: true } },
        },
      },
    },
    orderBy: [{ logDate: 'desc' }, { id: 'desc' }],
  });

  const inspectorIds = new Set(logs.map((l) => l.inspectorId));
  const jobIds = new Set(logs.map((l) => l.jobId));
  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const totalProductive = logs.reduce((s, l) => s + l.productiveHours, 0);

  res.json({
    period: { start: periodStart, end: periodEnd },
    totals: {
      entries: logs.length,
      hours: Math.round(totalHours * 10) / 10,
      productiveHours: Math.round(totalProductive * 10) / 10,
      inspectors: inspectorIds.size,
      jobs: jobIds.size,
    },
    items: logs.map((l) => ({
      id: l.id,
      logDate: l.logDate,
      hours: l.hours,
      productiveHours: l.productiveHours,
      narrative: l.narrative,
      inspectorId: l.inspector.id,
      inspectorName: l.inspector.name,
      employeeNo: l.inspector.employeeNo,
      jobId: l.job.id,
      jobRef: l.job.ref,
      jobTitle: l.job.title,
      jobStatus: l.job.status,
      client: l.job.client.name,
    })),
  });
});

const HOURS_PER_DAY = 8;

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

/** Admin-only cost / margin report (CM-013). */
router.get('/costs', requireRole('Admin'), async (req, res) => {
  const { periodStart, periodEnd } = parsePeriod(req.query as { periodStart?: string; periodEnd?: string });
  const from = new Date(periodStart + 'T00:00:00');
  const to = new Date(periodEnd + 'T23:59:59');

  const [logs, assignments] = await Promise.all([
    prisma.activityLog.findMany({
      where: { logDate: { gte: from, lte: to } },
      include: {
        inspector: {
          select: {
            id: true,
            name: true,
            employeeNo: true,
            dailyCostUsd: true,
            dailyBillableUsd: true,
          },
        },
        job: {
          select: {
            id: true,
            ref: true,
            title: true,
            status: true,
            agreedPriceUsd: true,
            client: { select: { name: true } },
          },
        },
      },
    }),
    prisma.assignment.findMany({
      where: { status: { notIn: ['Cancelled'] } },
      select: {
        jobId: true,
        inspectorId: true,
        dailyCostUsd: true,
        dailyBillableUsd: true,
        status: true,
      },
    }),
  ]);

  const assignmentKey = (jobId: number, inspectorId: number) => `${jobId}:${inspectorId}`;
  const snapshotByPair = new Map<string, { dailyCostUsd: number | null; dailyBillableUsd: number | null }>();
  for (const a of assignments) {
    snapshotByPair.set(assignmentKey(a.jobId, a.inspectorId), {
      dailyCostUsd: a.dailyCostUsd,
      dailyBillableUsd: a.dailyBillableUsd,
    });
  }

  type JobAgg = {
    jobId: number;
    jobRef: string;
    jobTitle: string;
    jobStatus: string;
    client: string;
    inspectorId: number;
    inspectorName: string;
    employeeNo: string;
    hours: number;
    dailyCostUsd: number | null;
    dailyBillableUsd: number | null;
    rateSource: 'assignment' | 'current' | 'none';
    costQar: number;
    billableQar: number;
    agreedPriceUsd: number | null;
  };

  const byJobInspector = new Map<string, JobAgg>();

  for (const log of logs) {
    const key = assignmentKey(log.jobId, log.inspectorId);
    const snap = snapshotByPair.get(key);
    let dailyCost = snap?.dailyCostUsd ?? null;
    let dailyBillable = snap?.dailyBillableUsd ?? null;
    let rateSource: JobAgg['rateSource'] = 'assignment';
    if (dailyCost == null && dailyBillable == null) {
      dailyCost = log.inspector.dailyCostUsd;
      dailyBillable = log.inspector.dailyBillableUsd;
      rateSource = dailyCost != null || dailyBillable != null ? 'current' : 'none';
    } else if (snap && (snap.dailyCostUsd != null || snap.dailyBillableUsd != null)) {
      rateSource = 'assignment';
    }

    const days = log.hours / HOURS_PER_DAY;
    const costQar = (dailyCost ?? 0) * days;
    const billableQar = (dailyBillable ?? 0) * days;

    const existing = byJobInspector.get(key);
    if (existing) {
      existing.hours += log.hours;
      existing.costQar += costQar;
      existing.billableQar += billableQar;
    } else {
      byJobInspector.set(key, {
        jobId: log.job.id,
        jobRef: log.job.ref,
        jobTitle: log.job.title,
        jobStatus: log.job.status,
        client: log.job.client.name,
        inspectorId: log.inspector.id,
        inspectorName: log.inspector.name,
        employeeNo: log.inspector.employeeNo,
        hours: log.hours,
        dailyCostUsd: dailyCost,
        dailyBillableUsd: dailyBillable,
        rateSource,
        costQar,
        billableQar,
        agreedPriceUsd: log.job.agreedPriceUsd,
      });
    }
  }

  const jobs = [...byJobInspector.values()].map((row) => {
    const revenue = row.agreedPriceUsd ?? 0;
    const cost = roundMoney(row.costQar);
    return {
      ...row,
      hours: Math.round(row.hours * 10) / 10,
      costQar: cost,
      billableQar: roundMoney(row.billableQar),
      revenueQar: row.agreedPriceUsd != null ? roundMoney(revenue) : null,
      marginQar: row.agreedPriceUsd != null ? roundMoney(revenue - cost) : null,
    };
  });

  type InspAgg = {
    inspectorId: number;
    inspectorName: string;
    employeeNo: string;
    hours: number;
    costQar: number;
    billableQar: number;
    revenueQar: number;
    jobs: number;
  };
  const byInspector = new Map<number, InspAgg>();
  const revenueClaimed = new Set<number>();

  for (const row of jobs) {
    let ins = byInspector.get(row.inspectorId);
    if (!ins) {
      ins = {
        inspectorId: row.inspectorId,
        inspectorName: row.inspectorName,
        employeeNo: row.employeeNo,
        hours: 0,
        costQar: 0,
        billableQar: 0,
        revenueQar: 0,
        jobs: 0,
      };
      byInspector.set(row.inspectorId, ins);
    }
    ins.hours += row.hours;
    ins.costQar += row.costQar;
    ins.billableQar += row.billableQar;
    ins.jobs += 1;
    // Attribute agreed job price once per job (first inspector row wins for multi-inspector UAT edge cases).
    if (row.revenueQar != null && !revenueClaimed.has(row.jobId)) {
      ins.revenueQar += row.revenueQar;
      revenueClaimed.add(row.jobId);
    }
  }

  const inspectors = [...byInspector.values()]
    .map((r) => ({
      ...r,
      hours: Math.round(r.hours * 10) / 10,
      costQar: roundMoney(r.costQar),
      billableQar: roundMoney(r.billableQar),
      revenueQar: roundMoney(r.revenueQar),
      marginQar: roundMoney(r.revenueQar - r.costQar),
    }))
    .sort((a, b) => b.costQar - a.costQar);

  const totalCost = roundMoney(jobs.reduce((s, j) => s + j.costQar, 0));
  const totalBillable = roundMoney(jobs.reduce((s, j) => s + j.billableQar, 0));
  const totalRevenue = roundMoney(
    [...new Set(jobs.filter((j) => j.revenueQar != null).map((j) => j.jobId))].reduce((s, jobId) => {
      const row = jobs.find((j) => j.jobId === jobId);
      return s + (row?.revenueQar ?? 0);
    }, 0)
  );
  const totalHours = Math.round(jobs.reduce((s, j) => s + j.hours, 0) * 10) / 10;

  res.json({
    period: { start: periodStart, end: periodEnd },
    methodology: {
      hoursPerDay: HOURS_PER_DAY,
      notes: [
        'Cost = (logged hours ÷ 8) × daily CTC. Prefer assignment snapshot from assign time; fall back to current inspector rates.',
        'Billable target uses daily billable the same way.',
        'Revenue uses Job.agreedPriceUsd once per job. Margin = revenue − cost.',
        'Amounts display as QAR (schema fields remain *Usd).',
      ],
    },
    totals: {
      hours: totalHours,
      costQar: totalCost,
      billableQar: totalBillable,
      revenueQar: totalRevenue,
      marginQar: roundMoney(totalRevenue - totalCost),
      inspectors: inspectors.length,
      jobs: new Set(jobs.map((j) => j.jobId)).size,
    },
    inspectors,
    jobs: jobs.sort((a, b) => b.costQar - a.costQar),
  });
});

export default router;
