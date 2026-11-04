import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { certStatusFromExpiry } from '../lib/certStatus.js';
import { recordAudit } from '../services/audit.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { getInspectorForUser, isAdmin, isStaff } from '../services/authz.js';
import { validateBody } from '../lib/validate.js';
import {
  createClientSchema,
  updateClientSchema,
  createInspectorSchema,
  createCertificationSchema,
  inspectorCostsSchema,
  inspectorQeApprovedSchema,
} from '../lib/schemas.js';
import { geocodeSampleLocation } from '../lib/geo.js';
import bcrypt from 'bcryptjs';
import { IdentityProvider, UserRole } from '@prisma/client';

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
    if (model === 'certification') {
      res.json(await prisma.certification.findMany({ orderBy: { code: 'asc' } }));
    }
  });

  if (model === 'certification') {
    router.post('/', requireRole(...staffRoles), validateBody(createCertificationSchema), async (req, res) => {
      const body = req.body as {
        code: string;
        name: string;
        issuer?: string | null;
        validityMonths?: number | null;
      };
      const code = body.code.trim().toUpperCase();
      const clash = await prisma.certification.findUnique({ where: { code } });
      if (clash) {
        res.status(409).json({ error: 'A qualification with this code already exists' });
        return;
      }
      const created = await prisma.certification.create({
        data: {
          code,
          name: body.name.trim(),
          issuer: body.issuer?.trim() || null,
          validityMonths: body.validityMonths ?? null,
        },
      });
      await recordAudit({
        userId: req.user!.id,
        action: 'Certification.Create',
        entityType: 'Certification',
        entityId: created.id,
        payload: { code: created.code, name: created.name },
      });
      res.status(201).json(created);
    });
  }

  if (model === 'client') {
    router.post('/', requireRole(...staffRoles), validateBody(createClientSchema), async (req, res) => {
      const body = req.body as {
        name: string;
        industry?: string | null;
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        contact?: string | null;
        email?: string | null;
      };

      let latitude = body.latitude ?? null;
      let longitude = body.longitude ?? null;
      if (latitude == null || longitude == null) {
        const geo = geocodeSampleLocation(body.location);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      }

      const created = await prisma.client.create({
        data: {
          name: body.name,
          industry: body.industry || null,
          location: body.location || null,
          latitude,
          longitude,
          contact: body.contact || null,
          email: body.email ? body.email : null,
        },
      });

      await recordAudit({
        userId: req.user!.id,
        action: 'Client.Create',
        entityType: 'Client',
        entityId: created.id,
        payload: {
          name: created.name,
          location: created.location,
          latitude: created.latitude,
          longitude: created.longitude,
        },
      });

      res.status(201).json(created);
    });

    router.put('/:id', requireRole(...staffRoles), validateBody(updateClientSchema), async (req, res) => {
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        res.status(400).json({ error: 'Invalid client id' });
        return;
      }
      const existing = await prisma.client.findUnique({ where: { id } });
      if (!existing) {
        res.status(404).json({ error: 'Client not found' });
        return;
      }

      const body = req.body as {
        name?: string;
        industry?: string | null;
        location?: string | null;
        latitude?: number | null;
        longitude?: number | null;
        contact?: string | null;
        email?: string | null;
      };

      const nextLocation = body.location !== undefined ? body.location || null : existing.location;
      let latitude = body.latitude !== undefined ? body.latitude : existing.latitude;
      let longitude = body.longitude !== undefined ? body.longitude : existing.longitude;

      // If location changed and coords were not explicitly sent, try place-name geocode.
      if (body.location !== undefined && body.latitude === undefined && body.longitude === undefined) {
        const geo = geocodeSampleLocation(nextLocation);
        if (geo) {
          latitude = geo.latitude;
          longitude = geo.longitude;
        }
      }

      const updated = await prisma.client.update({
        where: { id },
        data: {
          ...(body.name !== undefined ? { name: body.name } : {}),
          ...(body.industry !== undefined ? { industry: body.industry || null } : {}),
          ...(body.location !== undefined ? { location: nextLocation } : {}),
          ...(body.latitude !== undefined || body.longitude !== undefined || body.location !== undefined
            ? { latitude, longitude }
            : {}),
          ...(body.contact !== undefined ? { contact: body.contact || null } : {}),
          ...(body.email !== undefined ? { email: body.email ? body.email : null } : {}),
        },
      });

      await recordAudit({
        userId: req.user!.id,
        action: 'Client.Update',
        entityType: 'Client',
        entityId: updated.id,
        payload: {
          name: updated.name,
          location: updated.location,
          latitude: updated.latitude,
          longitude: updated.longitude,
        },
      });

      res.json(updated);
    });
  }

  if (model === 'inspector') {
    router.post('/', requireRole(...staffRoles), validateBody(createInspectorSchema), async (req, res) => {
      const body = req.body as {
        employeeNo: string;
        name: string;
        departmentId: number;
        email?: string | null;
        jobTitle?: string | null;
        hireDate?: string | null;
        baseLocation?: string | null;
        weeklyCapacityHrs?: number;
        qeApproved?: boolean;
        status?: 'Active' | 'OnLeave' | 'Training' | 'Inactive';
      };

      const department = await prisma.department.findUnique({ where: { id: body.departmentId } });
      if (!department) {
        res.status(400).json({ error: 'Department not found' });
        return;
      }

      const clash = await prisma.inspector.findUnique({ where: { employeeNo: body.employeeNo } });
      if (clash) {
        res.status(409).json({ error: 'Employee number already exists' });
        return;
      }

      const email = body.email?.trim() ? body.email.trim().toLowerCase() : null;
      let userId: number | null = null;
      if (email) {
        const existingUser = await prisma.user.findUnique({ where: { email } });
        if (existingUser) {
          if (existingUser.role !== UserRole.Inspector) {
            res.status(409).json({ error: 'Email belongs to a non-inspector user' });
            return;
          }
          userId = existingUser.id;
        } else {
          const passwordHash = await bcrypt.hash('password123', 10);
          const user = await prisma.user.create({
            data: {
              email,
              passwordHash,
              fullName: body.name,
              role: UserRole.Inspector,
              identityProvider: IdentityProvider.local,
            },
          });
          userId = user.id;
        }
      }

      const created = await prisma.inspector.create({
        data: {
          employeeNo: body.employeeNo,
          name: body.name,
          departmentId: body.departmentId,
          email,
          userId,
          jobTitle: body.jobTitle || null,
          hireDate: body.hireDate ? new Date(body.hireDate + 'T12:00:00') : null,
          baseLocation: body.baseLocation || null,
          weeklyCapacityHrs: body.weeklyCapacityHrs ?? 40,
          qeApproved: body.qeApproved ?? false,
          status: body.status ?? 'Active',
        },
        include: { department: true, inspectorCerts: { include: { certification: true } } },
      });

      await recordAudit({
        userId: req.user!.id,
        action: 'Inspector.Create',
        entityType: 'Inspector',
        entityId: created.id,
        payload: {
          employeeNo: created.employeeNo,
          name: created.name,
          departmentId: created.departmentId,
          jobTitle: created.jobTitle,
        },
      });

      res.status(201).json(created);
    });

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
