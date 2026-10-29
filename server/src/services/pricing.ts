import { prisma } from '../lib/prisma.js';

const SAMPLE_TYPE_PRICES: Record<string, number> = {
  PVI: 4500,
  'NDT-UT': 5200,
  WELD: 3800,
  MECH: 2800,
};

export async function resolveDefaultPriceUsd(job: { jobTypeId: number | null }): Promise<number | null> {
  if (job.jobTypeId) {
    const type = await prisma.jobType.findUnique({ where: { id: job.jobTypeId } });
    if (type?.defaultPriceUsd != null) return type.defaultPriceUsd;
    const typeRow = await prisma.priceChart.findUnique({ where: { jobTypeId: job.jobTypeId } });
    if (typeRow) return typeRow.priceUsd;
  }
  const global = await prisma.priceChart.findFirst({ where: { jobTypeId: null } });
  return global?.priceUsd ?? null;
}

export async function getPriceChart() {
  const [types, rows] = await Promise.all([
    prisma.jobType.findMany({ orderBy: { name: 'asc' } }),
    prisma.priceChart.findMany(),
  ]);
  const byType = new Map(rows.filter((r) => r.jobTypeId != null).map((r) => [r.jobTypeId!, r]));
  const global = rows.find((r) => r.jobTypeId == null);
  return {
    globalDefaultUsd: global?.priceUsd ?? 0,
    items: types.map((t) => ({
      jobTypeId: t.id,
      code: t.code,
      name: t.name,
      priceUsd: t.defaultPriceUsd ?? byType.get(t.id)?.priceUsd ?? global?.priceUsd ?? null,
    })),
  };
}

export async function ensurePriceChartDefaults() {
  const global = await prisma.priceChart.findFirst({ where: { jobTypeId: null } });
  if (!global) {
    await prisma.priceChart.create({ data: { jobTypeId: null, priceUsd: 3000 } });
  }
  const types = await prisma.jobType.findMany();
  for (const type of types) {
    if (type.defaultPriceUsd == null && SAMPLE_TYPE_PRICES[type.code] != null) {
      await prisma.jobType.update({
        where: { id: type.id },
        data: { defaultPriceUsd: SAMPLE_TYPE_PRICES[type.code] },
      });
    }
  }
}
