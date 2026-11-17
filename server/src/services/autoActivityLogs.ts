import { prisma } from '../lib/prisma.js';
import { defaultHoursForJob } from './jobTypeRates.js';

function ymd(d: Date) {
  return d.toISOString().slice(0, 10);
}

function addDaysYmd(iso: string, days: number) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function eachDateInclusive(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const out: string[] = [];
  let cur = from;
  let guard = 0;
  while (cur <= to && guard < 92) {
    out.push(cur);
    cur = addDaysYmd(cur, 1);
    guard += 1;
  }
  return out;
}

/**
 * CM-036: when a job is Active with assignees, ensure one activity row per
 * inspector per calendar day in their mob→demob window (skip days that already exist).
 * Staff can still edit/delete these rows.
 */
export async function ensureAutoActivityLogs(jobId: number): Promise<{ created: number }> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      jobType: true,
      assignments: {
        where: { status: { in: ['Accepted', 'Active', 'PendingAcceptance'] } },
      },
    },
  });
  if (!job) return { created: 0 };
  if (!['Active', 'PendingAcceptance'].includes(job.status)) return { created: 0 };
  if (job.assignments.length === 0) return { created: 0 };

  const hoursPerDay = defaultHoursForJob(job.rateBasis, job.jobType, 8);
  let created = 0;

  for (const a of job.assignments) {
    const start = ymd(a.mobDate ?? job.startDate);
    const end = ymd(a.demobDate ?? job.endDate);
    const days = eachDateInclusive(start, end);
    for (const day of days) {
      const existing = await prisma.activityLog.findFirst({
        where: {
          jobId,
          inspectorId: a.inspectorId,
          logDate: new Date(day + 'T12:00:00'),
        },
        select: { id: true },
      });
      if (existing) continue;

      await prisma.activityLog.create({
        data: {
          jobId,
          inspectorId: a.inspectorId,
          logDate: new Date(day + 'T12:00:00'),
          hours: hoursPerDay,
          productiveHours: Math.round(hoursPerDay * 0.9 * 10) / 10,
          narrative: 'Auto-logged from job schedule',
          qualityScore: 90,
        },
      });
      created += 1;
    }
  }

  return { created };
}
