import { prisma } from '../lib/prisma.js';
import { geocodeSampleLocation, qatarLocationForLegacy } from '../lib/geo.js';
import { ensurePriceChartDefaults } from './pricing.js';

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

export async function applyProductDefaults() {
  await ensureClientCoordinates();
  await ensureJobCoordinates();
  await ensurePriceChartDefaults();
  await ensureInspectorCostHistoryBaseline();
}
