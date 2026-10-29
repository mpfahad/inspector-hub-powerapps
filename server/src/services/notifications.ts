import type { UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

export async function notifyUser(userEmail: string, title: string, body: string, link?: string) {
  if (!userEmail) return;
  await prisma.notification.create({
    data: { userEmail, title, body, link: link ?? null },
  });
}

export async function notifyRole(role: UserRole, title: string, body: string, link?: string) {
  const users = await prisma.user.findMany({ where: { role }, select: { email: true } });
  await Promise.all(users.map((u) => notifyUser(u.email, title, body, link)));
}

export async function notifyRoles(roles: UserRole[], title: string, body: string, link?: string) {
  await Promise.all(roles.map((role) => notifyRole(role, title, body, link)));
}
