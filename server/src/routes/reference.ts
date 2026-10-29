import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { certStatusFromExpiry } from '../lib/certStatus.js';
import { recordAudit } from '../services/audit.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getInspectorForUser, isAdmin, isStaff } from '../services/authz.js';
import { validateBody } from '../lib/validate.js';
import { inspectorCostsSchema, inspectorQeApprovedSchema } from '../lib/schemas.js';

const staffRoles = ['Coordinator', 'Manager', 'Admin'] as const;

/** Strip internal cost fields unless caller is Admin (CM-013). */
function withoutCostFields<T extends Record<string, unknown>>(row: T, admin: boolean): T {
  if (admin) return row;
  const { dailyCostUsd: _c, dailyBillableUsd: _b, costHistory: _h, ...rest } = row as T & {
    dailyCostUsd?: unknown;
    dailyBillableUsd?: unknown;
    costHistory?: unknown;
  };
  return rest as T;
}

function parseDateOnly(value: unknown, field: string): Date {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`${field} must be YYYY-MM-DD`);
  }
  return new Date(value + 'T12:00:00');
}

function crudRouter(model: 'client' | 'inspector' | 'department' | 'certification') {
  const router = Router();
  router.use(authMiddleware);

  router.get('/', async (req, res) => {
    if (model === 'client') {
      if (!isStaff(req.user!.role)) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      res.json(await prisma.client.findMany({ orderBy: { name: 'asc' } }));
      return;
    }
    if (model === 'inspector') {
      const admin = isAdmin(req.user!.role);
      if (!isStaff(req.user!.role)) {
        const inspector = await getInspectorForUser(req.user!);
        if (!inspector) {
          res.json([]);
          return;
        }
        const rows = await prisma.inspector.findMany({
          where: { id: inspector.id },
          include: { department: true, inspectorCerts: { include: { certification: true } } },
        });
        res.json(
          rows.map((ins) =>
            withoutCostFields(
              {
                ...ins,
                inspectorCerts: ins.inspectorCerts.map((c) => ({
                  ...c,
                  status: certStatusFromExpiry(c.expiresOn),
                })),
              },
              admin
            )
          )
        );
        return;
      }
      const rows = await prisma.inspector.findMany({
        include: { department: true, inspectorCerts: { include: { certification: true } } },
      });
      res.json(
        rows.map((ins) =>
          withoutCostFields(
            {
              ...ins,
              inspectorCerts: ins.inspectorCerts.map((c) => ({
                ...c,
                status: certStatusFromExpiry(c.expiresOn),
              })),
            },
            admin
          )
        )
      );
      return;
    }
    if (model === 'department') res.json(await prisma.department.findMany());
    if (model === 'certification') res.json(await prisma.certification.findMany());
  });

  if (model === 'inspector') {
    router.get('/:id', async (req, res) => {
      const id = Number(req.params.id);
      const admin = isAdmin(req.user!.role);
      if (!isStaff(req.user!.role)) {
        const self = await getInspectorForUser(req.user!);
        if (!self || self.id !== id) {
          res.status(404).json({ error: 'Not found' });
          return;
        }
      }
      const inspector = await prisma.inspector.findUnique({
        where: { id },
        include: {
          department: true,
          inspectorCerts: { include: { certification: true }, orderBy: { expiresOn: 'asc' } },
          assignments: {
            include: { job: { include: { client: true, department: true } } },
            orderBy: { createdAt: 'desc' },
            take: 30,
          },
          leaveRequests: { orderBy: { startDate: 'desc' }, take: 10 },
          activityLogs: {
            include: { job: { include: { client: true } } },
            orderBy: { logDate: 'desc' },
            take: 15,
          },
          ...(admin ? { costHistory: { orderBy: { createdAt: 'desc' as const }, take: 25 } } : {}),
        },
      });

      if (!inspector) {
        res.status(404).json({ error: 'Not found' });
        return;
      }

      const activeAssignments = inspector.assignments.filter((a) =>
        ['PendingAcceptance', 'Accepted', 'Active'].includes(a.status)
      );
      const allocatedHours = activeAssignments.reduce((sum, a) => sum + a.allocatedHours, 0);

      // Always reflect live validity from expiresOn (stored status can lag).
      const inspectorCerts = inspector.inspectorCerts.map((c) => ({
        ...c,
        status: certStatusFromExpiry(c.expiresOn),
      }));

      res.json(
        withoutCostFields(
          {
            ...inspector,
            inspectorCerts,
            stats: {
              activeAssignments: activeAssignments.length,
              allocatedHours,
              totalAssignments: inspector.assignments.length,
              certCount: inspectorCerts.length,
            },
          },
          admin
        )
      );
    });

    router.put('/:id/costs', requireRole('Admin'), validateBody(inspectorCostsSchema), async (req, res) => {
      const inspectorId = Number(req.params.id);
      const { dailyCostUsd, dailyBillableUsd } = req.body as {
        dailyCostUsd: number;
        dailyBillableUsd: number;
      };
      const inspector = await prisma.inspector.findUnique({ where: { id: inspectorId } });
      if (!inspector) {
        res.status(404).json({ error: 'Inspector not found' });
        return;
      }

      const updated = await prisma.inspector.update({
        where: { id: inspectorId },
        data: { dailyCostUsd, dailyBillableUsd },
      });
      const history = await prisma.inspectorCostHistory.create({
        data: {
          inspectorId,
          dailyCostUsd,
          dailyBillableUsd,
          changedByEmail: req.user?.email,
        },
      });
      await recordAudit({
        userId: req.user!.id,
        action: 'Inspector.CostsUpdate',
        entityType: 'Inspector',
        entityId: inspectorId,
        payload: { dailyCostUsd, dailyBillableUsd },
      });
      res.json({
        dailyCostUsd: updated.dailyCostUsd,
        dailyBillableUsd: updated.dailyBillableUsd,
        history,
      });
    });

    router.put('/:id/qe-approved', requireRole(...staffRoles), validateBody(inspectorQeApprovedSchema), async (req, res) => {
      const inspectorId = Number(req.params.id);
      const { qeApproved } = req.body as { qeApproved: boolean };
      const inspector = await prisma.inspector.findUnique({ where: { id: inspectorId } });
      if (!inspector) {
        res.status(404).json({ error: 'Inspector not found' });
        return;
      }
      const updated = await prisma.inspector.update({
        where: { id: inspectorId },
        data: { qeApproved },
      });
      await recordAudit({
        userId: req.user!.id,
        action: 'Inspector.QeApprovedUpdate',
        entityType: 'Inspector',
        entityId: inspectorId,
        payload: { qeApproved },
      });
      res.json({ id: updated.id, qeApproved: updated.qeApproved });
    });

    router.post('/:id/certs', requireRole(...staffRoles), async (req, res) => {
      try {
        const inspectorId = Number(req.params.id);
        const certificationId = Number(req.body.certificationId);
        if (!Number.isFinite(inspectorId) || !Number.isFinite(certificationId)) {
          res.status(400).json({ error: 'inspectorId and certificationId are required' });
          return;
        }

        const issuedOn = parseDateOnly(req.body.issuedOn, 'issuedOn');
        const expiresOn = parseDateOnly(req.body.expiresOn, 'expiresOn');
        if (expiresOn < issuedOn) {
          res.status(400).json({ error: 'expiresOn must be on or after issuedOn' });
          return;
        }

        const inspector = await prisma.inspector.findUnique({ where: { id: inspectorId } });
        if (!inspector) {
          res.status(404).json({ error: 'Inspector not found' });
          return;
        }
        const certification = await prisma.certification.findUnique({ where: { id: certificationId } });
        if (!certification) {
          res.status(404).json({ error: 'Certification not found' });
          return;
        }

        const existing = await prisma.inspectorCert.findFirst({
          where: { inspectorId, certificationId },
        });
        if (existing) {
          res.status(409).json({ error: 'Inspector already has this certification — edit the existing record' });
          return;
        }

        const status = certStatusFromExpiry(expiresOn);
        const created = await prisma.inspectorCert.create({
          data: { inspectorId, certificationId, issuedOn, expiresOn, status },
          include: { certification: true },
        });

        await recordAudit({
          userId: req.user!.id,
          action: 'InspectorCert.Create',
          entityType: 'InspectorCert',
          entityId: created.id,
          payload: { inspectorId, certificationId, issuedOn: req.body.issuedOn, expiresOn: req.body.expiresOn, status },
        });

        res.status(201).json({ ...created, status });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Could not add certification' });
      }
    });

    router.put('/:id/certs/:certId', requireRole(...staffRoles), async (req, res) => {
      try {
        const inspectorId = Number(req.params.id);
        const certId = Number(req.params.certId);
        const row = await prisma.inspectorCert.findFirst({
          where: { id: certId, inspectorId },
          include: { certification: true },
        });
        if (!row) {
          res.status(404).json({ error: 'Certification record not found' });
          return;
        }

        const issuedOn =
          req.body.issuedOn !== undefined ? parseDateOnly(req.body.issuedOn, 'issuedOn') : row.issuedOn;
        const expiresOn =
          req.body.expiresOn !== undefined ? parseDateOnly(req.body.expiresOn, 'expiresOn') : row.expiresOn;
        if (expiresOn < issuedOn) {
          res.status(400).json({ error: 'expiresOn must be on or after issuedOn' });
          return;
        }

        let certificationId = row.certificationId;
        if (req.body.certificationId !== undefined) {
          certificationId = Number(req.body.certificationId);
          if (!Number.isFinite(certificationId)) {
            res.status(400).json({ error: 'Invalid certificationId' });
            return;
          }
          const clash = await prisma.inspectorCert.findFirst({
            where: { inspectorId, certificationId, NOT: { id: certId } },
          });
          if (clash) {
            res.status(409).json({ error: 'Inspector already has that certification' });
            return;
          }
        }

        const status = certStatusFromExpiry(expiresOn);
        const updated = await prisma.inspectorCert.update({
          where: { id: certId },
          data: { issuedOn, expiresOn, certificationId, status },
          include: { certification: true },
        });

        await recordAudit({
          userId: req.user!.id,
          action: 'InspectorCert.Update',
          entityType: 'InspectorCert',
          entityId: updated.id,
          payload: {
            inspectorId,
            certificationId,
            issuedOn: issuedOn.toISOString().slice(0, 10),
            expiresOn: expiresOn.toISOString().slice(0, 10),
            status,
          },
        });

        res.json({ ...updated, status });
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Could not update certification' });
      }
    });

    router.delete('/:id/certs/:certId', requireRole(...staffRoles), async (req, res) => {
      const inspectorId = Number(req.params.id);
      const certId = Number(req.params.certId);
      const row = await prisma.inspectorCert.findFirst({ where: { id: certId, inspectorId } });
      if (!row) {
        res.status(404).json({ error: 'Certification record not found' });
        return;
      }

      await prisma.inspectorCert.delete({ where: { id: certId } });
      await recordAudit({
        userId: req.user!.id,
        action: 'InspectorCert.Delete',
        entityType: 'InspectorCert',
        entityId: certId,
        payload: { inspectorId, certificationId: row.certificationId },
      });
      res.json({ ok: true });
    });
  }

  return router;
}

export const clientsRouter = crudRouter('client');
export const inspectorsRouter = crudRouter('inspector');
export const departmentsRouter = crudRouter('department');
export const certificationsRouter = crudRouter('certification');
