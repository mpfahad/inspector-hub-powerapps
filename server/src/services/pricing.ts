import { prisma } from '../lib/prisma.js';
import { rateForJobBasis, syncJobTypeRates } from './jobTypeRates.js';

const SAMPLE_TYPE_PRICES: Record<string, number> = {
  PVI: 4500,
  'NDT-UT': 5200,
  WELD: 3800,
  MECH: 2800,
};

/** Commercial default from job type for this job’s rate basis (day vs hourly). */
export async function resolveDefaultPriceUsd(job: {
  jobTypeId: number | null;
  rateBasis?: string | null;
}): Promise<number | null> {
  if (!job.jobTypeId) return null;
  const type = await prisma.jobType.findUnique({ where: { id: job.jobTypeId } });
  if (!type) return null;
  return rateForJobBasis(job.rateBasis ?? 'day', type);
}

export async function getPriceChart(departmentId?: number) {
  const types = await prisma.jobType.findMany({
    where: departmentId ? { departmentId } : undefined,
    include: { department: true },
    orderBy: { name: 'asc' },
  });
  return {
    globalDefaultUsd: null as number | null,
    items: types.map((t) => {
      const synced = syncJobTypeRates(t);
      return {
        jobTypeId: t.id,
        code: t.code,
        name: t.name,
        departmentId: t.departmentId,
        departmentName: t.department.name,
        priceUsd: synced.dayRateUsd,
        dayRateUsd: synced.dayRateUsd,
        hourRateUsd: synced.hourRateUsd,
        defaultHours: synced.defaultHours,
      };
    }),
  };
}

/** Seed sample day rates onto job types that still have no price. */
export async function ensurePriceChartDefaults() {
  const types = await prisma.jobType.findMany();
  for (const type of types) {
    if (type.dayRateUsd == null && type.defaultPriceUsd == null && SAMPLE_TYPE_PRICES[type.code] != null) {
      const rates = syncJobTypeRates({ dayRateUsd: SAMPLE_TYPE_PRICES[type.code], defaultHours: 8 });
      await prisma.jobType.update({
        where: { id: type.id },
        data: rates,
      });
    } else if (type.dayRateUsd == null && type.defaultPriceUsd != null) {
      const rates = syncJobTypeRates({
        dayRateUsd: type.defaultPriceUsd,
        hourRateUsd: type.hourRateUsd,
        defaultHours: type.defaultHours ?? 8,
      });
      await prisma.jobType.update({ where: { id: type.id }, data: rates });
    }
  }
}
