import { formatMoney } from '../../lib/money';

export type TeamSlot = {
  key: string;
  assignmentId?: number;
  inspectorId: string;
  startDate: string;
  endDate: string;
  dayRate: string;
};

export type TeamSlotInspectorOption = {
  id: number;
  name: string;
  employeeNo: string;
  dailyBillableUsd?: number | null;
  department?: { name: string };
};

/** Inclusive calendar days between YYYY-MM-DD dates. */
export function inclusiveDays(start: string, end: string): number {
  if (!start || !end || end < start) return 0;
  const a = new Date(start.slice(0, 10) + 'T00:00:00');
  const b = new Date(end.slice(0, 10) + 'T00:00:00');
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86_400_000) + 1;
}

export function slotRowTotal(slot: TeamSlot): number {
  const rate = Number(slot.dayRate);
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return inclusiveDays(slot.startDate, slot.endDate) * rate;
}

export function emptyTeamSlots(
  count: number,
  defaults: { startDate: string; endDate: string }
): TeamSlot[] {
  const n = Math.min(20, Math.max(0, count));
  return Array.from({ length: n }, (_, i) => ({
    key: `slot-${i}-${Math.random().toString(36).slice(2, 8)}`,
    inspectorId: '',
    startDate: defaults.startDate,
    endDate: defaults.endDate,
    dayRate: '',
  }));
}

export function filledTeamSlots(slots: TeamSlot[]) {
  return slots.filter((s) => s.inspectorId);
}

type Props = {
  slots: TeamSlot[];
  inspectors: TeamSlotInspectorOption[];
  onChange: (slots: TeamSlot[]) => void;
  disabled?: boolean;
};

export function TeamSlotsEditor({ slots, inspectors, onChange, disabled }: Props) {
  const update = (key: string, patch: Partial<TeamSlot>) => {
    onChange(slots.map((s) => (s.key === key ? { ...s, ...patch } : s)));
  };

  const usedIds = new Set(slots.map((s) => s.inspectorId).filter(Boolean));

  const teamTotal = slots.reduce((sum, s) => sum + slotRowTotal(s), 0);

  return (
    <div className="space-y-3">
      {slots.map((slot, index) => {
        const days = inclusiveDays(slot.startDate, slot.endDate);
        const total = slotRowTotal(slot);
        return (
          <div
            key={slot.key}
            className="rounded-lg border border-slate-200 p-3 grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,0.9fr))_minmax(0,0.8fr)] gap-3 items-end"
          >
            <div>
              <label className="text-xs text-slate-500">Inspector {index + 1}</label>
              <select
                className="input mt-1"
                value={slot.inspectorId}
                disabled={disabled}
                onChange={(e) => {
                  const id = e.target.value;
                  const ins = inspectors.find((i) => String(i.id) === id);
                  update(slot.key, {
                    inspectorId: id,
                    dayRate:
                      ins?.dailyBillableUsd != null
                        ? String(ins.dailyBillableUsd)
                        : slot.dayRate,
                  });
                }}
              >
                <option value="">— Leave blank —</option>
                {inspectors.map((ins) => {
                  const taken = usedIds.has(String(ins.id)) && String(ins.id) !== slot.inspectorId;
                  return (
                    <option key={ins.id} value={ins.id} disabled={taken}>
                      {ins.name} ({ins.employeeNo})
                      {ins.department ? ` · ${ins.department.name}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="text-xs text-slate-500">Start</label>
              <input
                type="date"
                className="input mt-1"
                value={slot.startDate}
                disabled={disabled}
                onChange={(e) => update(slot.key, { startDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">End</label>
              <input
                type="date"
                className="input mt-1"
                value={slot.endDate}
                disabled={disabled}
                onChange={(e) => update(slot.key, { endDate: e.target.value })}
              />
            </div>
            <div>
              <label className="text-xs text-slate-500">Day rate (QAR)</label>
              <input
                type="number"
                min="0"
                step="1"
                className="input mt-1"
                value={slot.dayRate}
                disabled={disabled}
                onChange={(e) => update(slot.key, { dayRate: e.target.value })}
              />
            </div>
            <div className="text-sm pb-2">
              <div className="text-xs text-slate-500">Row total</div>
              <div className="font-medium text-navy tabular-nums">
                {days > 0 && slot.dayRate !== '' ? formatMoney(total) : '—'}
              </div>
              {days > 0 && (
                <div className="text-[11px] text-slate-400">{days} day{days === 1 ? '' : 's'}</div>
              )}
            </div>
          </div>
        );
      })}
      {slots.length > 0 && (
        <div className="flex justify-end text-sm text-slate-600">
          Team total (est.):{' '}
          <span className="font-semibold text-navy ml-1 tabular-nums">{formatMoney(teamTotal)}</span>
        </div>
      )}
    </div>
  );
}
