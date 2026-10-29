import { Router, type Request } from 'express';
import PDFDocument from 'pdfkit';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getTimesheetForUser, getInspectorForUser } from '../services/authz.js';
import { sendRouteError } from '../lib/httpErrors.js';

const router = Router();
router.use(authMiddleware);

function previousMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const end = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start, end };
}

function parseDate(value: string, endOfDay = false) {
  const d = new Date(value);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

async function resolveInspectorId(req: Request, requestedId?: number) {
  if (req.user?.role === 'Inspector') {
    const inspector = await getInspectorForUser(req.user);
    if (!inspector) throw new Error('Inspector profile not found');
    return inspector.id;
  }
  if (!requestedId) throw new Error('Inspector is required');
  return requestedId;
}

async function buildTimesheetData(inspectorId: number, periodStart: Date, periodEnd: Date) {
  const inspector = await prisma.inspector.findUnique({
    where: { id: inspectorId },
    include: { department: true },
  });
  if (!inspector) throw new Error('Inspector not found');

  const logs = await prisma.activityLog.findMany({
    where: {
      inspectorId,
      logDate: { gte: periodStart, lte: periodEnd },
    },
    include: { job: { include: { client: true } } },
    orderBy: { logDate: 'asc' },
  });

  const totalHours = logs.reduce((s, l) => s + l.hours, 0);
  const totalProductive = logs.reduce((s, l) => s + l.productiveHours, 0);

  return { inspector, logs, totalHours, totalProductive };
}

function renderTimesheetPdf(
  doc: PDFKit.PDFDocument,
  data: Awaited<ReturnType<typeof buildTimesheetData>>,
  periodStart: Date,
  periodEnd: Date,
  ref: string
) {
  const { inspector, logs, totalHours, totalProductive } = data;

  doc.fontSize(18).text('IRPPMS — INSPECTOR TIMESHEET', { align: 'center' });
  doc.moveDown();
  doc.fontSize(10).text(`Reference: ${ref}`);
  doc.text(`Inspector: ${inspector.name} (${inspector.employeeNo})`);
  doc.text(`Department: ${inspector.department.name}`);
  doc.text(
    `Period: ${periodStart.toISOString().slice(0, 10)} — ${periodEnd.toISOString().slice(0, 10)}`
  );
  doc.moveDown();

  doc.fontSize(11).text('Activity', { underline: true });
  doc.moveDown(0.5);

  if (logs.length === 0) {
    doc.fontSize(9).text('No activity logged in this period.');
  } else {
    for (const line of logs) {
      doc.fontSize(9).text(
        `${line.logDate.toISOString().slice(0, 10)}  |  ${line.job.ref}  |  ${line.hours}h / ${line.productiveHours}h productive  |  ${line.narrative ?? ''}`
      );
    }
  }

  doc.moveDown();
  doc.text(`Total hours: ${totalHours}    Productive: ${totalProductive}`);
  doc.moveDown();
  doc.fontSize(8).text(`Generated ${new Date().toISOString()}`);
}

router.get('/defaults', (_req, res) => {
  const { start, end } = previousMonthRange();
  res.json({
    periodStart: start.toISOString().slice(0, 10),
    periodEnd: end.toISOString().slice(0, 10),
  });
});

router.get('/', async (req, res) => {
  let inspectorId = req.query.inspectorId ? Number(req.query.inspectorId) : undefined;
  if (req.user?.role === 'Inspector') {
    const inspector = await getInspectorForUser(req.user);
    if (!inspector) {
      res.json([]);
      return;
    }
    inspectorId = inspector.id;
  }
  const timesheets = await prisma.timesheet.findMany({
    where: inspectorId ? { inspectorId } : undefined,
    include: { inspector: true, job: true, lines: true },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(timesheets);
});

router.post(
  '/generate',
  requireRole('Inspector', 'Coordinator', 'Manager', 'Admin'),
  async (req, res) => {
    try {
      const body = req.body as { inspectorId?: number; periodStart?: string; periodEnd?: string };
      const defaults = previousMonthRange();
      const periodStart = body.periodStart ? parseDate(body.periodStart) : defaults.start;
      const periodEnd = body.periodEnd ? parseDate(body.periodEnd, true) : defaults.end;

      const inspectorId = await resolveInspectorId(req, body.inspectorId);
      const data = await buildTimesheetData(inspectorId, periodStart, periodEnd);

      const ref = `TS-${inspectorId}-${periodStart.toISOString().slice(0, 7)}-${Date.now().toString(36).toUpperCase()}`;
      const timesheet = await prisma.timesheet.create({
        data: {
          ref,
          inspectorId,
          periodStart,
          periodEnd,
          generatedByEmail: req.user?.email,
          totalHours: data.totalHours,
          totalProductiveHours: data.totalProductive,
          lines: {
            create: data.logs.map((l) => ({
              logDate: l.logDate,
              hours: l.hours,
              productiveHours: l.productiveHours,
              description: `${l.job.ref}: ${l.narrative ?? ''}`,
            })),
          },
        },
        include: { inspector: true, lines: true },
      });

      res.status(201).json(timesheet);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Generate failed' });
    }
  }
);

router.get(
  '/preview',
  requireRole('Inspector', 'Coordinator', 'Manager', 'Admin'),
  async (req, res) => {
    try {
      const defaults = previousMonthRange();
      const periodStart = req.query.periodStart
        ? parseDate(String(req.query.periodStart))
        : defaults.start;
      const periodEnd = req.query.periodEnd
        ? parseDate(String(req.query.periodEnd), true)
        : defaults.end;
      const inspectorId = await resolveInspectorId(
        req,
        req.query.inspectorId ? Number(req.query.inspectorId) : undefined
      );

      const data = await buildTimesheetData(inspectorId, periodStart, periodEnd);
      res.json({
        inspector: {
          name: data.inspector.name,
          employeeNo: data.inspector.employeeNo,
          department: data.inspector.department.name,
        },
        periodStart: periodStart.toISOString(),
        periodEnd: periodEnd.toISOString(),
        totalHours: data.totalHours,
        totalProductiveHours: data.totalProductive,
        lines: data.logs.map((l) => ({
          logDate: l.logDate.toISOString(),
          jobRef: l.job.ref,
          jobTitle: l.job.title,
          client: l.job.client.name,
          hours: l.hours,
          productiveHours: l.productiveHours,
          narrative: l.narrative,
        })),
      });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Preview failed' });
    }
  }
);

router.get(
  '/report.pdf',
  requireRole('Inspector', 'Coordinator', 'Manager', 'Admin'),
  async (req, res) => {
    try {
      const defaults = previousMonthRange();
      const periodStart = req.query.periodStart
        ? parseDate(String(req.query.periodStart))
        : defaults.start;
      const periodEnd = req.query.periodEnd
        ? parseDate(String(req.query.periodEnd), true)
        : defaults.end;
      const inspectorId = await resolveInspectorId(
        req,
        req.query.inspectorId ? Number(req.query.inspectorId) : undefined
      );

      const data = await buildTimesheetData(inspectorId, periodStart, periodEnd);
      const ref = `TS-${inspectorId}-${periodStart.toISOString().slice(0, 7)}`;

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${ref}.pdf"`);

      const doc = new PDFDocument({ margin: 50 });
      doc.pipe(res);
      renderTimesheetPdf(doc, data, periodStart, periodEnd, ref);
      doc.end();
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'PDF failed' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const ts = await getTimesheetForUser(Number(req.params.id), req.user!);
    res.json(ts);
  } catch (err) {
    sendRouteError(res, err, 'Not found');
  }
});

router.get('/:id/pdf', async (req, res) => {
  try {
    const ts = await getTimesheetForUser(Number(req.params.id), req.user!);

    const logs = ts.lines.map((line) => ({
      logDate: line.logDate,
      hours: line.hours,
      productiveHours: line.productiveHours,
      narrative: line.description,
      job: { ref: '—' },
    }));

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${ts.ref}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    renderTimesheetPdf(
      doc,
      {
        inspector: ts.inspector,
        logs: logs as never,
        totalHours: ts.totalHours,
        totalProductive: ts.totalProductiveHours,
      },
      ts.periodStart,
      ts.periodEnd,
      ts.ref
    );
    doc.end();
  } catch (err) {
    sendRouteError(res, err, 'PDF failed');
  }
});

export default router;
