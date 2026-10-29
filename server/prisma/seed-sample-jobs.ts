/**
 * Upsert sample / historical jobs so Reports (activity, performance, overdue, cost) have data.
 * Safe to re-run: removes prior SAMPLE-* jobs then recreates. Does not wipe roster/clients.
 *
 * Usage: npx tsx prisma/seed-sample-jobs.ts   (from server/)
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const REF_PREFIX = 'SAMPLE-';

function daysAgo(n: number) {
  const x = new Date();
  x.setHours(12, 0, 0, 0);
  x.setDate(x.getDate() - n);
  return x;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

async function wipeSampleJobs() {
  const existing = await prisma.job.findMany({
    where: { ref: { startsWith: REF_PREFIX } },
    select: { id: true },
  });
  const ids = existing.map((j) => j.id);
  if (ids.length === 0) return 0;

  await prisma.timesheetLine.deleteMany({ where: { timesheet: { jobId: { in: ids } } } });
  await prisma.timesheet.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.activityLog.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.assignmentResponse.deleteMany({ where: { assignment: { jobId: { in: ids } } } });
  await prisma.assignment.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.assignmentProposal.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.jobStatusHistory.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.jobCertRequirement.deleteMany({ where: { jobId: { in: ids } } });
  await prisma.job.deleteMany({ where: { id: { in: ids } } });
  return ids.length;
}

async function ensureLiftingJobType() {
  return prisma.jobType.upsert({
    where: { code: 'LIFT-EQ' },
    create: {
      code: 'LIFT-EQ',
      name: 'Lifting Equipment Inspection',
      description: 'LEEA / ISO 17020 lifting equipment examinations',
      defaultPriceUsd: 4200,
      active: true,
    },
    update: { name: 'Lifting Equipment Inspection', defaultPriceUsd: 4200, active: true },
  });
}

async function main() {
  const removed = await wipeSampleJobs();

  const lifting =
    (await prisma.department.findFirst({ where: { code: 'LIFT' } })) ??
    (await prisma.department.findFirst({ where: { name: 'Lifting' } }));
  if (!lifting) throw new Error('Lifting department missing — run import-roster or seed first');

  const clients = await prisma.client.findMany({ orderBy: { name: 'asc' } });
  if (clients.length < 3) throw new Error('Need Qatar clients — run import-roster first');

  const inspectors = await prisma.inspector.findMany({
    where: { status: 'Active', departmentId: lifting.id },
    orderBy: { name: 'asc' },
  });
  if (inspectors.length < 4) throw new Error('Need roster inspectors — run import-roster first');

  const qeInspectors = inspectors.filter((i) => i.qeApproved);
  const jobType = await ensureLiftingJobType();

  const pick = <T,>(arr: T[], i: number) => arr[i % arr.length];
  const client = (i: number) => pick(clients, i);
  const insp = (i: number) => pick(inspectors, i);
  const qe = (i: number) => (qeInspectors.length ? pick(qeInspectors, i) : insp(i));

  type JobSpec = {
    ref: string;
    title: string;
    clientIdx: number;
    inspectorIdx: number;
    useQe?: boolean;
    requiresQe?: boolean;
    status: 'Draft' | 'Proposed' | 'Active' | 'Closed';
    startOffset: number; // days ago
    endOffset: number;
    completedOffset?: number; // days ago when closed
    late?: boolean;
    agreedPriceUsd: number;
    hoursPerDay: number;
    logDays: number[]; // offsets from start for activity (relative day index 0..)
    narratives: string[];
  };

  const specs: JobSpec[] = [
    // —— Last month closed (on time) ——
    {
      ref: `${REF_PREFIX}2608-01`,
      title: 'Overhead crane thorough examination — Ras Laffan',
      clientIdx: 0,
      inspectorIdx: 0,
      useQe: true,
      status: 'Closed',
      startOffset: 45,
      endOffset: 38,
      completedOffset: 39,
      agreedPriceUsd: 4800,
      hoursPerDay: 8,
      logDays: [0, 1, 2, 3, 4],
      narratives: [
        'Site induction and crane visual survey',
        'Load path NDT and wire rope inspection',
        'Functional tests with site ops',
        'Defect recording and client walkthrough',
        'Report drafting and close-out',
      ],
    },
    {
      ref: `${REF_PREFIX}2608-02`,
      title: 'MEWP fleet periodic inspection — Mesaieed',
      clientIdx: 1,
      inspectorIdx: 2,
      status: 'Closed',
      startOffset: 42,
      endOffset: 36,
      completedOffset: 36,
      agreedPriceUsd: 3600,
      hoursPerDay: 7,
      logDays: [0, 1, 2, 3],
      narratives: ['Yard access and unit tagging', 'Structural checks units 1–6', 'Functional tests', 'Certificate pack'],
    },
    {
      ref: `${REF_PREFIX}2608-03`,
      title: 'Offshore container CSC / OCE survey',
      clientIdx: 2,
      inspectorIdx: 4,
      useQe: true,
      status: 'Closed',
      startOffset: 40,
      endOffset: 33,
      completedOffset: 31,
      late: true,
      agreedPriceUsd: 5200,
      hoursPerDay: 8,
      logDays: [0, 1, 2, 4, 5, 6],
      narratives: [
        'Container yard mobilisation',
        'Structural / weld examination',
        'Corner casting and door tests',
        'Client query on repairs',
        'Re-inspection after repairs',
        'Final certificates issued',
      ],
    },
    // —— This month closed ——
    {
      ref: `${REF_PREFIX}2609-01`,
      title: 'Forklift LOLER examination — Doha warehouse',
      clientIdx: 3,
      inspectorIdx: 1,
      status: 'Closed',
      startOffset: 12,
      endOffset: 8,
      completedOffset: 8,
      agreedPriceUsd: 2800,
      hoursPerDay: 8,
      logDays: [0, 1, 2],
      narratives: ['Pre-use checks and serial verification', 'Mast and chains inspection', 'Load test and docs'],
    },
    {
      ref: `${REF_PREFIX}2609-02`,
      title: 'Mobile crane examination — Al Khor',
      clientIdx: 4,
      inspectorIdx: 3,
      useQe: true,
      requiresQe: true,
      status: 'Closed',
      startOffset: 10,
      endOffset: 5,
      completedOffset: 4,
      late: false,
      agreedPriceUsd: 6500,
      hoursPerDay: 9,
      logDays: [0, 1, 2, 3, 4],
      narratives: [
        'Outrigger pads and slew checks',
        'Wire rope and sheave inspection',
        'Rated capacity indicator verification',
        'Load test with calibrated weights',
        'Report and QE sign-off pack',
      ],
    },
    {
      ref: `${REF_PREFIX}2609-03`,
      title: 'Runway beam / RCS inspection — industrial park',
      clientIdx: 5,
      inspectorIdx: 5,
      status: 'Closed',
      startOffset: 18,
      endOffset: 14,
      completedOffset: 12,
      late: true,
      agreedPriceUsd: 4100,
      hoursPerDay: 6,
      logDays: [0, 1, 2, 4],
      narratives: ['Access scaffold setup', 'Beam alignment survey', 'End-stop and trolley checks', 'Remedial follow-up'],
    },
    // —— Active (healthy) ——
    {
      ref: `${REF_PREFIX}2609-A1`,
      title: 'LEEA LEG thorough exam — Lusail tower crane',
      clientIdx: 6,
      inspectorIdx: 0,
      useQe: true,
      status: 'Active',
      startOffset: 3,
      endOffset: -4,
      agreedPriceUsd: 7200,
      hoursPerDay: 8,
      logDays: [0, 1, 2],
      narratives: ['Induction and isolation plan', 'Upper works visual', 'Hoist / trolley systems'],
    },
    {
      ref: `${REF_PREFIX}2609-A2`,
      title: 'Lifting accessories batch inspection',
      clientIdx: 7,
      inspectorIdx: 2,
      status: 'Active',
      startOffset: 2,
      endOffset: -5,
      agreedPriceUsd: 2200,
      hoursPerDay: 7,
      logDays: [0, 1],
      narratives: ['Slings and shackles colour-code', 'Chain blocks and lever hoists'],
    },
    // —— Active overdue ——
    {
      ref: `${REF_PREFIX}2609-OD1`,
      title: 'Elevator / hoist shaft examination (overdue)',
      clientIdx: 8,
      inspectorIdx: 6,
      status: 'Active',
      startOffset: 20,
      endOffset: 5,
      agreedPriceUsd: 3900,
      hoursPerDay: 5,
      logDays: [0, 2, 5, 8],
      narratives: [
        'Initial shaft access',
        'Guide rail inspection paused — waiting parts',
        'Partial continuation',
        'Still blocked on client isolation window',
      ],
    },
    {
      ref: `${REF_PREFIX}2609-OD2`,
      title: 'Quayside gantry crane — delayed finish',
      clientIdx: 0,
      inspectorIdx: 1,
      useQe: true,
      status: 'Active',
      startOffset: 25,
      endOffset: 8,
      agreedPriceUsd: 8800,
      hoursPerDay: 8,
      logDays: [0, 1, 3, 6, 10],
      narratives: [
        'Kick-off with port authority',
        'Boom and A-frame survey',
        'Weather delay — standby',
        'NDT on critical welds',
        'Awaiting load-test window',
      ],
    },
    // —— New / pipeline (Draft + Proposed, no assignment) ——
    {
      ref: `${REF_PREFIX}2609-D1`,
      title: 'Draft: annual LEEA scope review',
      clientIdx: 1,
      inspectorIdx: 0,
      status: 'Draft',
      startOffset: -7,
      endOffset: -14,
      agreedPriceUsd: 3000,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-D2`,
      title: 'Draft: pedestal crane baseline survey — Ras Laffan',
      clientIdx: 0,
      inspectorIdx: 0,
      status: 'Draft',
      startOffset: -3,
      endOffset: -10,
      agreedPriceUsd: 5400,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-D3`,
      title: 'Draft: forklift fleet intake — Industrial Area',
      clientIdx: 3,
      inspectorIdx: 0,
      status: 'Draft',
      startOffset: -5,
      endOffset: -12,
      agreedPriceUsd: 2600,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-D4`,
      title: 'Draft: wire rope / sling stock check — warehouse',
      clientIdx: 9,
      inspectorIdx: 0,
      status: 'Draft',
      startOffset: -1,
      endOffset: -6,
      agreedPriceUsd: 1800,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-P1`,
      title: 'Proposed: MEWP hire-fleet audit',
      clientIdx: 2,
      inspectorIdx: 3,
      status: 'Proposed',
      startOffset: -2,
      endOffset: -9,
      agreedPriceUsd: 4500,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-P2`,
      title: 'Proposed: overhead travelling crane — Al Khor yard',
      clientIdx: 8,
      inspectorIdx: 0,
      useQe: true,
      requiresQe: true,
      status: 'Proposed',
      startOffset: -4,
      endOffset: -11,
      agreedPriceUsd: 6100,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-P3`,
      title: 'Proposed: offshore container batch CSC exam',
      clientIdx: 5,
      inspectorIdx: 0,
      status: 'Proposed',
      startOffset: -6,
      endOffset: -13,
      agreedPriceUsd: 4900,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-P4`,
      title: 'Proposed: LEEA LMP power machines — Dukhan',
      clientIdx: 7,
      inspectorIdx: 0,
      status: 'Proposed',
      startOffset: -8,
      endOffset: -15,
      agreedPriceUsd: 3800,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
    {
      ref: `${REF_PREFIX}2609-P5`,
      title: 'Proposed: elevator / goods hoist annual — Lusail',
      clientIdx: 6,
      inspectorIdx: 0,
      status: 'Proposed',
      startOffset: -9,
      endOffset: -16,
      agreedPriceUsd: 3200,
      hoursPerDay: 0,
      logDays: [],
      narratives: [],
    },
  ];

  let created = 0;
  let logs = 0;

  for (const spec of specs) {
    const startDate = daysAgo(spec.startOffset);
    const endDate = daysAgo(spec.endOffset);
    const inspector = spec.useQe || spec.requiresQe ? qe(spec.inspectorIdx) : insp(spec.inspectorIdx);
    const c = client(spec.clientIdx);

    const completedAt =
      spec.status === 'Closed' && spec.completedOffset != null ? daysAgo(spec.completedOffset) : null;

    const job = await prisma.job.create({
      data: {
        ref: spec.ref,
        title: spec.title,
        clientId: c.id,
        departmentId: lifting.id,
        jobTypeId: jobType.id,
        scope: 'UAT sample job for reports / cost / activity demonstrations.',
        location: c.location,
        latitude: c.latitude,
        longitude: c.longitude,
        startDate,
        endDate,
        status: spec.status,
        priority: spec.status === 'Active' && spec.endOffset > 0 ? 'High' : 'Normal',
        estimatedHours: Math.max(8, spec.logDays.length * (spec.hoursPerDay || 8)),
        requiredInspectorCount: 1,
        requiresQeApproval: !!spec.requiresQe,
        agreedPriceUsd: spec.agreedPriceUsd,
        createdByEmail: 'coordinator@irppms.local',
        completedAt,
        completedByEmail: completedAt ? inspector.email : null,
        closingComments: completedAt
          ? spec.late
            ? 'Closed after planned end — sample late completion.'
            : 'Closed on schedule — sample.'
          : null,
      },
    });

    const history: { jobId: number; fromStatus: string; toStatus: string; userEmail: string; note: string }[] = [];
    if (spec.status !== 'Draft') {
      history.push({
        jobId: job.id,
        fromStatus: 'Draft',
        toStatus: 'Proposed',
        userEmail: 'coordinator@irppms.local',
        note: 'Sample submit',
      });
    }
    if (spec.status === 'Active' || spec.status === 'Closed') {
      history.push({
        jobId: job.id,
        fromStatus: 'Proposed',
        toStatus: 'Active',
        userEmail: 'coordinator@irppms.local',
        note: 'Sample assign',
      });
    }
    if (spec.status === 'Closed') {
      history.push({
        jobId: job.id,
        fromStatus: 'Active',
        toStatus: 'Closed',
        userEmail: inspector.email ?? 'coordinator@irppms.local',
        note: 'Sample complete',
      });
    }
    if (history.length) {
      await prisma.jobStatusHistory.createMany({ data: history as never });
    }

    if (spec.status === 'Active' || spec.status === 'Closed') {
      await prisma.assignment.create({
        data: {
          jobId: job.id,
          inspectorId: inspector.id,
          role: 'Lead',
          allocatedHours: job.estimatedHours,
          status: 'Active',
          createdByEmail: 'coordinator@irppms.local',
          decidedAt: startDate,
          dailyCostUsd: inspector.dailyCostUsd,
          dailyBillableUsd: inspector.dailyBillableUsd,
        },
      });

      for (let i = 0; i < spec.logDays.length; i++) {
        const dayOffset = spec.logDays[i];
        const logDate = new Date(startDate);
        logDate.setDate(logDate.getDate() + dayOffset);
        const hours = spec.hoursPerDay || 8;
        await prisma.activityLog.create({
          data: {
            jobId: job.id,
            inspectorId: inspector.id,
            logDate,
            hours,
            productiveHours: Math.max(4, hours - 1),
            narrative: spec.narratives[i] ?? `Day ${dayOffset + 1} progress`,
            qualityScore: 4,
          },
        });
        logs += 1;
      }
    }

    created += 1;
  }

  console.log(`Removed previous sample jobs: ${removed}`);
  console.log(`Created sample jobs: ${created}`);
  console.log(`Activity log entries: ${logs}`);
  console.log(`Window covers ~last 45 days through next week (today ${isoDay(new Date())}).`);
  console.log('Open Reports as Admin for Cost & margin; Coordinator sees Activity / Performance / Overdue.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
