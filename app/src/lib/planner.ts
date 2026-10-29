import type { PlannerAllocation, PlannerConflict, UtilizationBand } from './api';

export const BAND_STYLES: Record<
  UtilizationBand,
  { dot: string; cell: string; label: string }
> = {
  available: { dot: 'bg-teal', cell: 'bg-teal/5', label: 'Available' },
  partial: { dot: 'bg-amber-400', cell: 'bg-amber-50', label: 'Partially allocated' },
  heavy: { dot: 'bg-orange-500', cell: 'bg-orange-50', label: 'Heavy utilization' },
  full: { dot: 'bg-red-500', cell: 'bg-red-50', label: 'Fully allocated' },
  off: { dot: 'bg-slate-400', cell: 'bg-slate-100', label: 'Leave / Training' },
};

export const KIND_STYLES: Record<PlannerAllocation['kind'], string> = {
  job: 'bg-gradient-to-r from-navy to-steel text-white border-navy/30',
  training: 'bg-steel/20 text-navy border-steel/40',
  leave: 'bg-amber-100 text-amber-900 border-amber-300',
};

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function fmtRange(startIso: string, dayCount: number) {
  const start = new Date(startIso + 'T12:00:00');
  const end = new Date(start);
  end.setDate(start.getDate() + dayCount - 1);
  const o: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  if (dayCount === 1) {
    return start.toLocaleDateString(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });
  }
  return `${start.toLocaleDateString(undefined, o)} – ${end.toLocaleDateString(undefined, { ...o, year: 'numeric' })}`;
}

export function isWeekend(iso: string) {
  const d = new Date(iso + 'T12:00:00').getDay();
  return d === 0 || d === 6;
}

export function conflictLabel(type: PlannerConflict['type']) {
  const map: Record<PlannerConflict['type'], string> = {
    'double-booking': 'Double booking',
    'leave-overlap': 'Leave overlap',
    'training-overlap': 'Training overlap',
    'over-capacity': 'Over capacity',
  };
  return map[type];
}

export function conflictClass(type: PlannerConflict['type']) {
  const map: Record<PlannerConflict['type'], string> = {
    'double-booking': 'bg-red-100 text-red-800 border-red-200',
    'leave-overlap': 'bg-amber-100 text-amber-800 border-amber-200',
    'training-overlap': 'bg-slate-100 text-slate-700 border-slate-200',
    'over-capacity': 'bg-red-100 text-red-800 border-red-200',
  };
  return map[type];
}

export function initials(name: string) {
  return name
    .split(' ')
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}
