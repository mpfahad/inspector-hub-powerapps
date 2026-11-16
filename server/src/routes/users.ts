import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import {
  bulkImportUsersSchema,
  createUserSchema,
  deleteUsersSchema,
  resetPasswordsSchema,
  updateUserSchema,
} from '../lib/schemas.js';
import { validateBody } from '../lib/validate.js';
import { recordAudit } from '../services/audit.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole('Admin'));

const PRIMARY_ADMIN_EMAIL = 'fahad.mp@applus.com';

function randomTempPassword() {
  return randomBytes(9).toString('base64url').slice(0, 12);
}

async function userDeleteGuard(
  target: { id: number; email: string; role: string },
  actorId: number | undefined
): Promise<string | null> {
  if (actorId !== undefined && target.id === actorId) {
    return 'You cannot delete your own account';
  }
  if (target.email.toLowerCase() === PRIMARY_ADMIN_EMAIL) {
    return 'The primary Admin account cannot be deleted';
  }
  if (target.role === 'Admin') {
    const adminCount = await prisma.user.count({ where: { role: 'Admin' } });
    if (adminCount <= 1) {
      return 'Cannot delete the last Admin account';
    }
  }
  return null;
}

const userSelect = {
  id: true,
  email: true,
  fullName: true,
  role: true,
  identityProvider: true,
  createdAt: true,
  departmentAccess: {
    select: { departmentId: true, department: { select: { id: true, name: true, code: true } } },
  },
} as const;

router.get('/', async (_req, res) => {
  const users = await prisma.user.findMany({
    orderBy: { email: 'asc' },
    select: userSelect,
  });
  res.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      identityProvider: u.identityProvider,
      createdAt: u.createdAt,
      departments: u.departmentAccess.map((a) => a.department),
      allDepartments: u.departmentAccess.length === 0,
    }))
  );
});

router.post('/', validateBody(createUserSchema), async (req, res) => {
  const body = req.body as {
    email: string;
    fullName: string;
    role: 'Admin' | 'Manager' | 'Coordinator';
    password?: string;
    departmentIds?: number[];
  };
  const email = body.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: 'A user with that email already exists' });
    return;
  }

  const tempPassword = body.password?.trim() || randomTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 10);
  const departmentIds = body.departmentIds ?? [];

  const user = await prisma.user.create({
    data: {
      email,
      fullName: body.fullName.trim(),
      role: body.role,
      passwordHash,
      identityProvider: 'local',
      departmentAccess:
        departmentIds.length > 0
          ? { create: departmentIds.map((departmentId) => ({ departmentId })) }
          : undefined,
    },
    select: userSelect,
  });

  await recordAudit({
    userId: req.user?.id,
    action: 'user.create',
    entityType: 'User',
    entityId: user.id,
    payload: { email: user.email, role: user.role, departmentIds },
  });

  res.status(201).json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    identityProvider: user.identityProvider,
    createdAt: user.createdAt,
    departments: user.departmentAccess.map((a) => a.department),
    allDepartments: user.departmentAccess.length === 0,
    temporaryPassword: tempPassword,
  });
});

router.put('/:id', validateBody(updateUserSchema), async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const body = req.body as {
    fullName?: string;
    role?: 'Admin' | 'Manager' | 'Coordinator';
    password?: string;
    departmentIds?: number[];
  };

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }

  const data: {
    fullName?: string;
    role?: typeof body.role;
    passwordHash?: string;
  } = {};
  if (body.fullName !== undefined) data.fullName = body.fullName.trim();
  if (body.role !== undefined) data.role = body.role;
  let temporaryPassword: string | undefined;
  if (body.password?.trim()) {
    temporaryPassword = body.password.trim();
    data.passwordHash = await bcrypt.hash(temporaryPassword, 10);
  }

  if (body.departmentIds !== undefined) {
    await prisma.userDepartmentAccess.deleteMany({ where: { userId: id } });
    if (body.departmentIds.length > 0) {
      await prisma.userDepartmentAccess.createMany({
        data: body.departmentIds.map((departmentId) => ({ userId: id, departmentId })),
      });
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data,
    select: userSelect,
  });

  await recordAudit({
    userId: req.user?.id,
    action: 'user.update',
    entityType: 'User',
    entityId: user.id,
    payload: {
      role: user.role,
      departmentIds: body.departmentIds,
      passwordReset: Boolean(temporaryPassword),
    },
  });

  res.json({
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    identityProvider: user.identityProvider,
    createdAt: user.createdAt,
    departments: user.departmentAccess.map((a) => a.department),
    allDepartments: user.departmentAccess.length === 0,
    ...(temporaryPassword ? { temporaryPassword } : {}),
  });
});

/** Bulk create (or optional password reset) — returns plaintext passwords once for CSV export. */
router.post('/bulk-import', validateBody(bulkImportUsersSchema), async (req, res) => {
  const body = req.body as {
    users: {
      email: string;
      fullName: string;
      role: 'Admin' | 'Manager' | 'Coordinator';
      departmentCodes?: string[];
    }[];
    resetExistingPasswords?: boolean;
  };

  const depts = await prisma.department.findMany();
  const byCode = new Map(depts.map((d) => [d.code.toUpperCase(), d.id]));

  const created: {
    id: number;
    email: string;
    fullName: string;
    role: string;
    temporaryPassword: string;
    action: 'created' | 'password_reset' | 'skipped';
  }[] = [];
  const errors: { email: string; error: string }[] = [];

  for (const row of body.users) {
    const email = row.email.trim().toLowerCase();
    const codes = (row.departmentCodes ?? []).map((c) => c.trim().toUpperCase()).filter(Boolean);
    const departmentIds: number[] = [];
    let badCode = false;
    for (const code of codes) {
      const id = byCode.get(code);
      if (!id) {
        errors.push({ email, error: `Unknown department code: ${code}` });
        badCode = true;
        break;
      }
      departmentIds.push(id);
    }
    if (badCode) continue;

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      if (!body.resetExistingPasswords) {
        created.push({
          id: existing.id,
          email: existing.email,
          fullName: existing.fullName,
          role: existing.role,
          temporaryPassword: '',
          action: 'skipped',
        });
        continue;
      }
      const temporaryPassword = randomTempPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, 10);
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          fullName: row.fullName.trim(),
          role: row.role,
          passwordHash,
          identityProvider: 'local',
        },
      });
      await prisma.userDepartmentAccess.deleteMany({ where: { userId: existing.id } });
      if (departmentIds.length > 0) {
        await prisma.userDepartmentAccess.createMany({
          data: departmentIds.map((departmentId) => ({ userId: existing.id, departmentId })),
        });
      }
      created.push({
        id: existing.id,
        email,
        fullName: row.fullName.trim(),
        role: row.role,
        temporaryPassword,
        action: 'password_reset',
      });
      continue;
    }

    const temporaryPassword = randomTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    const user = await prisma.user.create({
      data: {
        email,
        fullName: row.fullName.trim(),
        role: row.role,
        passwordHash,
        identityProvider: 'local',
        departmentAccess:
          departmentIds.length > 0
            ? { create: departmentIds.map((departmentId) => ({ departmentId })) }
            : undefined,
      },
      select: { id: true },
    });
    created.push({
      id: user.id,
      email,
      fullName: row.fullName.trim(),
      role: row.role,
      temporaryPassword,
      action: 'created',
    });
  }

  await recordAudit({
    userId: req.user?.id,
    action: 'user.bulk_import',
    entityType: 'User',
    payload: {
      total: body.users.length,
      created: created.filter((c) => c.action === 'created').length,
      reset: created.filter((c) => c.action === 'password_reset').length,
      skipped: created.filter((c) => c.action === 'skipped').length,
      errors: errors.length,
    },
  });

  res.status(201).json({ items: created, errors });
});

/** Assign new random passwords to selected users; returns plaintext once for export. */
router.post('/reset-passwords', validateBody(resetPasswordsSchema), async (req, res) => {
  const { userIds } = req.body as { userIds: number[] };
  const items: { id: number; email: string; fullName: string; role: string; temporaryPassword: string }[] =
    [];

  for (const id of userIds) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) continue;
    const temporaryPassword = randomTempPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 10);
    await prisma.user.update({
      where: { id },
      data: { passwordHash, identityProvider: 'local' },
    });
    items.push({
      id: existing.id,
      email: existing.email,
      fullName: existing.fullName,
      role: existing.role,
      temporaryPassword,
    });
  }

  await recordAudit({
    userId: req.user?.id,
    action: 'user.reset_passwords',
    entityType: 'User',
    payload: { count: items.length, userIds: items.map((i) => i.id) },
  });

  res.json({ items });
});

router.post('/bulk-delete', validateBody(deleteUsersSchema), async (req, res) => {
  const { userIds } = req.body as { userIds: number[] };
  const deleted: { id: number; email: string; fullName: string }[] = [];
  const errors: { id: number; error: string }[] = [];
  const actorId = req.user?.id;

  for (const id of userIds) {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      errors.push({ id, error: 'Not found' });
      continue;
    }
    const blocked = await userDeleteGuard(existing, actorId);
    if (blocked) {
      errors.push({ id, error: blocked });
      continue;
    }
    await prisma.$transaction([
      prisma.inspector.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.auditEvent.updateMany({ where: { userId: id }, data: { userId: null } }),
      prisma.user.delete({ where: { id } }),
    ]);
    deleted.push({ id: existing.id, email: existing.email, fullName: existing.fullName });
  }

  if (deleted.length > 0) {
    await recordAudit({
      userId: actorId,
      action: 'user.bulk_delete',
      entityType: 'User',
      payload: { deleted, errors },
    });
  }

  res.json({ deleted, errors });
});

router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isFinite(id)) {
    res.status(400).json({ error: 'Invalid id' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: 'Not found' });
    return;
  }
  const blocked = await userDeleteGuard(existing, req.user?.id);
  if (blocked) {
    res.status(409).json({ error: blocked });
    return;
  }
  await prisma.$transaction([
    prisma.inspector.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.auditEvent.updateMany({ where: { userId: id }, data: { userId: null } }),
    prisma.user.delete({ where: { id } }),
  ]);
  await recordAudit({
    userId: req.user?.id,
    action: 'user.delete',
    entityType: 'User',
    entityId: id,
    payload: { email: existing.email, fullName: existing.fullName },
  });
  res.status(204).send();
});

export default router;
