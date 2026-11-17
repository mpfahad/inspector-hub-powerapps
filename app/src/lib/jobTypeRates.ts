/** Client mirror of server `jobTypeRates` — derive hour from day ÷ default hours when missing. */

export type JobTypeRateFields = {
  dayRateUsd?: number | null;
  hourRateUsd?: number | null;
  defaultHours?: number | null;
  defaultPriceUsd?: number | null;
};

function finitePositive(n: unknown): number | null {
  const v = typeof n === 'number' ? n : Number(n);
  if (!Number.isFinite(v) || v < 0) return null;
  return v;
}

function roundMoney(n: number) {
  return Math.round(n * 100) / 100;
}

function roundHours(n: number) {
  return Math.round(n * 10) / 10;
}

export function syncJobTypeRates(input: JobTypeRateFields): {
  dayRateUsd: number | null;
  hourRateUsd: number | null;
  defaultHours: number | null;
  defaultPriceUsd: number | null;
} {
  let day = finitePositive(input.dayRateUsd ?? input.defaultPriceUsd);
  let hour = finitePositive(input.hourRateUsd);
  let hours = finitePositive(input.defaultHours);

  const hasDay = day != null && day > 0;
  const hasHour = hour != null && hour > 0;
  const hasHours = hours != null && hours > 0;

  if (hasDay && hasHours && !hasHour) {
    hour = roundMoney(day! / hours!);
  } else if (hasHour && hasHours && !hasDay) {
    day = roundMoney(hour! * hours!);
  } else if (hasDay && hasHour && !hasHours) {
    hours = hour! > 0 ? roundHours(day! / hour!) : null;
  } else if (hasDay && !hasHours && !hasHour) {
    hours = 8;
    hour = roundMoney(day! / 8);
  }

  return {
    dayRateUsd: day,
    hourRateUsd: hour,
    defaultHours: hours,
    defaultPriceUsd: day,
  };
}

export function rateForJobBasis(
  rateBasis: 'day' | 'hourly' | string | null | undefined,
  type: JobTypeRateFields | null | undefined
): number | null {
  if (!type) return null;
  const synced = syncJobTypeRates(type);
  if (rateBasis === 'hourly') return synced.hourRateUsd;
  return synced.dayRateUsd ?? synced.defaultPriceUsd;
}

export function defaultHoursForJob(
  type: JobTypeRateFields | null | undefined,
  fallback = 8
): number {
  const synced = syncJobTypeRates(type ?? {});
  if (synced.defaultHours != null && synced.defaultHours > 0) return synced.defaultHours;
  return fallback;
}
