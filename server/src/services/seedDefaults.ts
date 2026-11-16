import bcrypt from 'bcryptjs';
import { prisma } from '../lib/prisma.js';
import { geocodeSampleLocation, qatarLocationForLegacy } from '../lib/geo.js';
import { ensurePriceChartDefaults } from './pricing.js';

/** Primary UAT admin — created if missing; password not overwritten on later startups. */
export async function ensurePrimaryAdmin() {
  const email = 'fahad.mp@applus.com';
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    if (existing.role !== 'Admin') {
      await prisma.user.update({ where: { id: existing.id }, data: { role: 'Admin' } });
    }
    return;
  }
  const passwordHash = await bcrypt.hash('ApplusHub2026!', 10);
  await prisma.user.create({
    data: {
      email,
      fullName: 'Fahad',
      role: 'Admin',
      passwordHash,
      identityProvider: 'local',
    },
  });
}

function migrateEntityToQatar(
  location: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): { location?: string; latitude: number; longitude: number } | null {
  const qatarName = qatarLocationForLegacy(location);
  const locationForGeo = qatarName ?? location;
  const geo = geocodeSampleLocation(locationForGeo) ?? geocodeSampleLocation(location);
  if (!geo) return null;

  if (qatarName) {
    const needsUpdate =
      location !== qatarName || latitude !== geo.latitude || longitude !== geo.longitude;
    if (!needsUpdate) return null;
    return { location: qatarName, latitude: geo.latitude, longitude: geo.longitude };
  }

  if (latitude == null || longitude == null) {
    return { latitude: geo.latitude, longitude: geo.longitude };
  }
  return null;
}

export async function ensureClientCoordinates() {
  const clients = await prisma.client.findMany();
  for (const client of clients) {
    const patch = migrateEntityToQatar(client.location, client.latitude, client.longitude);
    if (!patch) continue;
    await prisma.client.update({ where: { id: client.id }, data: patch });
  }
}

/** Remap jobs still on legacy US sample cities to Qatar. */
export async function ensureJobCoordinates() {
  const jobs = await prisma.job.findMany({
    select: { id: true, location: true, latitude: true, longitude: true },
  });
  for (const job of jobs) {
    const patch = migrateEntityToQatar(job.location, job.latitude, job.longitude);
    if (!patch) continue;
    await prisma.job.update({ where: { id: job.id }, data: patch });
  }
}

export async function ensureInspectorCostHistoryBaseline() {
  const inspectors = await prisma.inspector.findMany({
    where: {
      OR: [{ dailyCostUsd: { not: null } }, { dailyBillableUsd: { not: null } }],
      costHistory: { none: {} },
    },
    select: { id: true, dailyCostUsd: true, dailyBillableUsd: true },
  });
  for (const ins of inspectors) {
    await prisma.inspectorCostHistory.create({
      data: {
        inspectorId: ins.id,
        dailyCostUsd: ins.dailyCostUsd,
        dailyBillableUsd: ins.dailyBillableUsd,
        changedByEmail: 'system',
      },
    });
  }
}

/** CM-033: staff-only logins — drop Inspector User accounts; keep employee roster. */
export async function purgeInspectorLogins() {
  const inspectors = await prisma.user.findMany({
    where: { role: 'Inspector' },
    select: { id: true },
  });
  if (inspectors.length === 0) return 0;
  const ids = inspectors.map((u) => u.id);
  await prisma.$transaction([
    prisma.inspector.updateMany({ where: { userId: { in: ids } }, data: { userId: null } }),
    prisma.auditEvent.updateMany({ where: { userId: { in: ids } }, data: { userId: null } }),
    prisma.user.deleteMany({ where: { id: { in: ids } } }),
  ]);
  return ids.length;
}

export async function applyProductDefaults() {
  await ensurePrimaryAdmin();
  await purgeInspectorLogins();
  await ensureClientCoordinates();
  await ensureJobCoordinates();
  await ensurePriceChartDefaults();
  await ensureInspectorCostHistoryBaseline();
}
