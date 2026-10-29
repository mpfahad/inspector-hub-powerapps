import type { Inspector } from '@prisma/client';

export const STANDARD_DAY_HOURS = 8;

export type AllocationKind = 'job' | 'leave' | 'training';

export type PlannerAllocation = {
  id: string;
  inspectorId: number;
  kind: AllocationKind;
  title: string;
  ref?: string;
  start: string;
  end: string;
  hoursPerDay: number;
  location?: string;
  priority?: string;
  jobId?: number;
};

export type UtilizationBand = 'available' | 'partial' | 'heavy' | 'full' | 'off';

export type PlannerConflict = {
  inspectorId: number;
  inspectorName: string;
  date: string;
  type: 'double-booking' | 'leave-overlap' | 'training-overlap' | 'over-capacity';
  detail: string;
  hours: number;
};

export function isoDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function rangeDays(start: Date, count: number) {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

export function mondayOfWeek(base: Date) {
  const weekStart = new Date(base);
  weekStart.setHours(0, 0, 0, 0);
  const dayOfWeek = weekStart.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  weekStart.setDate(weekStart.getDate() + mondayOffset);
  return weekStart;
}

export function daySpan(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.ceil(ms / 86400000) + 1);
}

export function allocationsForDay(allocations: PlannerAllocation[], inspectorId: number, iso: string) {
  return allocations.filter((a) => a.inspectorId === inspectorId && iso >= a.start && iso <= a.end);
}

export function bandForHours(hours: number, hasOff: boolean): UtilizationBand {
  if (hasOff) return 'off';
  if (hours <= 0) return 'available';
  if (hours < 5) return 'partial';
  if (hours < STANDARD_DAY_HOURS) return 'heavy';
  return 'full';
}

export function dayLoad(allocations: PlannerAllocation[], inspectorId: number, iso: string) {
  const items = allocationsForDay(allocations, inspectorId, iso);
  const off = items.some((i) => i.kind === 'leave' || i.kind === 'training');
  const hours = items
    .filter((i) => i.kind === 'job')
    .reduce((s, i) => s + i.hoursPerDay, 0);
  return { items, hours, band: bandForHours(hours, off) };
}

export function detectConflicts(
  inspectors: { id: number; name: string }[],
  allocations: PlannerAllocation[]
): PlannerConflict[] {
  const out: PlannerConflict[] = [];

  for (const ins of inspectors) {
    const items = allocations.filter((a) => a.inspectorId === ins.id);
    const dates = new Set<string>();
    for (const a of items) {
      const s = new Date(a.start);
      const e = new Date(a.end);
      for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
        dates.add(isoDate(d));
      }
    }

    for (const date of dates) {
      const day = items.filter((a) => date >= a.start && date <= a.end);
      const hasLeave = day.some((d) => d.kind === 'leave');
      const hasTraining = day.some((d) => d.kind === 'training');
      const jobsOnDay = day.filter((d) => d.kind === 'job');
      const hours = jobsOnDay.reduce((s, d) => s + d.hoursPerDay, 0);

      if (hasLeave && jobsOnDay.length) {
        out.push({
          inspectorId: ins.id,
          inspectorName: ins.name,
          date,
          type: 'leave-overlap',
          hours,
          detail: `Job overlaps leave (${jobsOnDay.map((j) => j.ref ?? j.title).join(', ')})`,
        });
      }
      if (hasTraining && jobsOnDay.length) {
        out.push({
          inspectorId: ins.id,
          inspectorName: ins.name,
          date,
          type: 'training-overlap',
          hours,
          detail: 'Job overlaps scheduled training',
        });
      }
      if (jobsOnDay.length >= 2 && hours > STANDARD_DAY_HOURS) {
        out.push({
          inspectorId: ins.id,
          inspectorName: ins.name,
          date,
          type: 'double-booking',
          hours,
          detail: `Concurrent assignments (${hours}h booked)`,
        });
      } else if (hours > STANDARD_DAY_HOURS + 1) {
        out.push({
          inspectorId: ins.id,
          inspectorName: ins.name,
          date,
          type: 'over-capacity',
          hours,
          detail: `Booked ${hours}h vs ${STANDARD_DAY_HOURS}h standard capacity`,
        });
      }
    }
  }

  return Array.from(new Map(out.map((c) => [`${c.inspectorId}-${c.date}-${c.type}`, c])).values()).sort(
    (a, b) => a.date.localeCompare(b.date)
  );
}

export function capacitySummary(
  inspectors: Inspector[],
  isoDays: string[],
  allocations: PlannerAllocation[]
) {
  const totalCapacity = inspectors.length * isoDays.length * STANDARD_DAY_HOURS;
  let booked = 0;
  let onLeave = 0;
  let onTraining = 0;

  for (const ins of inspectors) {
    for (const iso of isoDays) {
      const d = dayLoad(allocations, ins.id, iso);
      if (d.items.some((x) => x.kind === 'leave')) onLeave += STANDARD_DAY_HOURS;
      else if (d.items.some((x) => x.kind === 'training')) onTraining += STANDARD_DAY_HOURS;
      else booked += d.hours;
    }
  }

  const available = Math.max(0, totalCapacity - booked - onLeave - onTraining);
  const utilization = Math.round(
    (booked / Math.max(1, totalCapacity - onLeave - onTraining)) * 100
  );

  return { totalCapacity, booked, onLeave, onTraining, available, utilization };
}

export function rollingUtilization(
  allocations: PlannerAllocation[],
  inspectorId: number,
  isoDays: string[]
) {
  let total = 0;
  for (const iso of isoDays) {
    total += dayLoad(allocations, inspectorId, iso).hours;
  }
  const capacity = isoDays.length * STANDARD_DAY_HOURS;
  return Math.round((total / Math.max(1, capacity)) * 100);
}
