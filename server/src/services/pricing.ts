import { prisma } from '../lib/prisma.js';

const SAMPLE_TYPE_PRICES: Record<string, number> = {
  PVI: 4500,
  'NDT-UT': 5200,
  WELD: 3800,
  MECH: 2800,
};

/** Commercial default comes only from the job type’s default price. */
export async function resolveDefaultPriceUsd(job: { jobTypeId: number | null }): Promise<number | null> {
  if (!job.jobTypeId) return null;
  const type = await prisma.jobType.findUnique({ where: { id: job.jobTypeId } });
  return type?.defaultPriceUsd ?? null;
}

export async function getPriceChart(departmentId?: number) {
  const types = await prisma.jobType.findMany({
    where: departmentId ? { departmentId } : undefined,
    include: { department: true },
    orderBy: { name: 'asc' },
  });
  return {
    globalDefaultUsd: null as number | null,
    items: types.map((t) => ({
      jobTypeId: t.id,
      code: t.code,
      name: t.name,
      departmentId: t.departmentId,
      departmentName: t.department.name,
      priceUsd: t.defaultPriceUsd ?? null,
    })),
  };
}

/** Seed sample defaults onto job types that still have no price. No global chart row. */
export async function ensurePriceChartDefaults() {
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
