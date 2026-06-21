/**
 * Resource Planner — ported from lovable-source/src/lib/scheduler.ts
 * PowerFx: build colAllocations with ClearCollect + Filter(Assignments, ...); band colors via Switch().
 */

export type AllocationKind = 'job' | 'leave' | 'training' | 'tentative';

export interface Allocation {
  id: string;
  inspectorId: number;
  employeeNo: string;
  kind: AllocationKind;
  title: string;
  ref?: string;
  start: string;
  end: string;
  hoursPerDay: number;
  location?: string;
  priority?: string;
}

export const allocations: Allocation[] = [
  { id: 'AL-1', inspectorId: 1, employeeNo: 'E-1042', kind: 'job', ref: 'J-2026-00184', title: 'Pressure Vessel — Skid 7', start: '2026-06-11', end: '2026-06-15', hoursPerDay: 9, location: 'Houston, TX', priority: 'High' },
  { id: 'AL-3', inspectorId: 2, employeeNo: 'E-1058', kind: 'job', ref: 'J-2026-00187', title: 'Phased Array UT — Pipeline 4B', start: '2026-06-13', end: '2026-06-17', hoursPerDay: 8, location: 'Long Beach, CA', priority: 'High' },
  { id: 'AL-5', inspectorId: 3, employeeNo: 'E-1077', kind: 'job', ref: 'J-2026-00185', title: 'Switchgear Acceptance Test', start: '2026-06-10', end: '2026-06-12', hoursPerDay: 9, location: 'Phoenix, AZ', priority: 'Urgent' },
  { id: 'AL-7', inspectorId: 4, employeeNo: 'E-1083', kind: 'leave', title: 'Annual Leave — Family', start: '2026-06-08', end: '2026-06-20', hoursPerDay: 8 },
  { id: 'AL-8', inspectorId: 5, employeeNo: 'E-1096', kind: 'job', ref: 'J-2026-00188', title: 'Site HSE Audit — Q2', start: '2026-06-14', end: '2026-06-14', hoursPerDay: 6, location: 'Dallas, TX', priority: 'Normal' },
  { id: 'AL-12', inspectorId: 6, employeeNo: 'E-1119', kind: 'job', ref: 'J-2026-00184', title: 'Pressure Vessel — Skid 7', start: '2026-06-11', end: '2026-06-15', hoursPerDay: 8, location: 'Houston, TX', priority: 'High' },
  { id: 'AL-14', inspectorId: 7, employeeNo: 'E-1132', kind: 'job', ref: 'J-2026-00186', title: 'Foundation Concrete QC', start: '2026-06-12', end: '2026-06-18', hoursPerDay: 8, location: 'Miami, FL', priority: 'Normal' },
];

export type UtilizationBand = 'available' | 'partial' | 'heavy' | 'full' | 'off';

export const bandColors: Record<UtilizationBand, { bg: string; label: string }> = {
  available: { bg: '#dff6dd', label: 'Available' },
  partial: { bg: '#fff4ce', label: 'Partial (0-4h)' },
  heavy: { bg: '#fed9cc', label: 'Heavy (4-8h)' },
  full: { bg: '#fde7e9', label: 'Fully booked' },
  off: { bg: '#edebe9', label: 'Leave / Training' },
};

export function allocationsForDay(inspectorId: number, iso: string): Allocation[] {
  return allocations.filter((a) => a.inspectorId === inspectorId && iso >= a.start && iso <= a.end);
}

export function bandForHours(hours: number, hasOff: boolean): UtilizationBand {
  if (hasOff) return 'off';
  if (hours <= 0) return 'available';
  if (hours < 5) return 'partial';
  if (hours < 8) return 'heavy';
  return 'full';
}

export function dayLoad(inspectorId: number, iso: string) {
  const items = allocationsForDay(inspectorId, iso);
  const off = items.some((i) => i.kind === 'leave' || i.kind === 'training');
  const hours = items.filter((i) => i.kind === 'job' || i.kind === 'tentative').reduce((s, i) => s + i.hoursPerDay, 0);
  return { items, hours, band: bandForHours(hours, off) };
}

export function rangeDays(startIso: string, count: number): string[] {
  const start = new Date(startIso);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export type Conflict = { inspectorId: number; date: string; reason: string };

/** PowerFx: ForAll(Inspectors, ForAll(colDates, ...)) — run client-side only for demo windows */
export function detectConflicts(): Conflict[] {
  const conflicts: Conflict[] = [];
  const dates = rangeDays('2026-06-10', 14);
  const inspectorIds = [...new Set(allocations.map((a) => a.inspectorId))];
  for (const inspectorId of inspectorIds) {
    for (const date of dates) {
      const jobs = allocationsForDay(inspectorId, date).filter((a) => a.kind === 'job');
      if (jobs.length > 1) {
        conflicts.push({ inspectorId, date, reason: `Double-booked: ${jobs.map((j) => j.title).join(' + ')}` });
      }
      const load = dayLoad(inspectorId, date);
      if (load.hours > 8) {
        conflicts.push({ inspectorId, date, reason: `Over-capacity: ${load.hours}h scheduled` });
      }
    }
  }
  return conflicts;
}
