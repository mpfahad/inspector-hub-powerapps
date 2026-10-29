import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type PlannerAllocation, type PlannerData } from '../lib/api';
import {
  addDays,
  BAND_STYLES,
  conflictClass,
  conflictLabel,
  fmtRange,
  initials,
  isWeekend,
  KIND_STYLES,
} from '../lib/planner';

type ViewMode = 'day' | 'week' | 'month';

const VIEW_STEP: Record<ViewMode, number> = { day: 1, week: 7, month: 28 };

function KpiCard({
  label,
  value,
  sub,
  accent,
  onClick,
}: {
  label: string;
  value: string | number;
  sub: string;
  accent?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`card p-4 text-left w-full ${onClick ? 'hover:border-teal/40 hover:shadow-md transition-all' : ''}`}
    >
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${accent ?? 'text-navy'}`}>{value}</div>
      <div className="text-[11px] text-slate-500 mt-0.5">{sub}</div>
    </button>
  );
}

function InspectorAvatar({ name }: { name: string }) {
  return (
    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-steel to-navy text-white text-[10px] font-semibold flex items-center justify-center shrink-0">
      {initials(name)}
    </div>
  );
}

function AllocationBar({
  allocation,
  span,
  offset,
  total,
}: {
  allocation: PlannerAllocation;
  span: number;
  offset: number;
  total: number;
}) {
  const icon = allocation.kind === 'leave' ? '✈' : allocation.kind === 'training' ? '🎓' : '📋';
  const className = `absolute top-1.5 bottom-1.5 rounded-md text-[11px] font-medium px-2 flex items-center gap-1 shadow-sm border truncate ${KIND_STYLES[allocation.kind]}`;
  const style = {
    left: `calc(${(offset / total) * 100}% + 2px)`,
    width: `calc(${(span / total) * 100}% - 4px)`,
  };
  const title = `${allocation.title}${allocation.ref ? ` (${allocation.ref})` : ''}\n${allocation.start} → ${allocation.end} · ${allocation.hoursPerDay}h/day${allocation.location ? `\n${allocation.location}` : ''}`;

  if (allocation.kind === 'job' && allocation.jobId) {
    return (
      <Link to={`/jobs/${allocation.jobId}`} className={className} style={style} title={title}>
        <span className="shrink-0">{icon}</span>
        <span className="truncate">{allocation.ref ?? allocation.title}</span>
      </Link>
    );
  }

  return (
    <div className={className} style={style} title={title}>
      <span className="shrink-0">{icon}</span>
      <span className="truncate">{allocation.ref ?? allocation.title}</span>
    </div>
  );
}

function TimelineGrid({ data }: { data: PlannerData }) {
  const isoList = data.days;

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[1100px]">
          <div className="grid grid-cols-[240px_1fr] border-b border-slate-200 bg-slate-50 sticky top-0 z-10">
            <div className="px-4 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500 border-r border-slate-200">
              Inspector
            </div>
            <div className="grid" style={{ gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))` }}>
              {data.days.map((d) => (
                <div
                  key={d}
                  className={`px-1 py-3 text-center border-r border-slate-200 last:border-r-0 ${isWeekend(d) ? 'bg-slate-100/80' : ''}`}
                >
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">
                    {new Date(d + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' })}
                  </div>
                  <div className="text-sm font-semibold text-navy">{new Date(d + 'T12:00:00').getDate()}</div>
                </div>
              ))}
            </div>
          </div>

          {data.inspectors.length === 0 ? (
            <p className="text-sm text-slate-500 p-8 text-center">No inspectors match this filter.</p>
          ) : (
            data.inspectors.map((row) => {
              const startIso = isoList[0];
              const endIso = isoList[isoList.length - 1];
              const items = row.allocations.filter((a) => a.end >= startIso && a.start <= endIso);

              return (
                <div
                  key={row.id}
                  className="grid grid-cols-[240px_1fr] border-b border-slate-100 last:border-b-0 hover:bg-slate-50/50"
                >
                  <div className="px-4 py-3 border-r border-slate-200 flex items-center gap-2.5">
                    <InspectorAvatar name={row.name} />
                    <div className="min-w-0">
                      <Link to={`/inspectors/${row.id}`} className="text-xs font-medium text-navy hover:text-teal truncate block">
                        {row.name}
                      </Link>
                      <div className="text-[10px] text-slate-500">
                        {row.department} · {row.utilization}% util
                      </div>
                    </div>
                  </div>
                  <div
                    className="relative grid min-h-[56px]"
                    style={{ gridTemplateColumns: `repeat(${data.days.length}, minmax(0, 1fr))` }}
                  >
                    {row.dayBands.map(({ date, band }) => (
                      <div
                        key={date}
                        className={`h-14 border-r border-slate-100 last:border-r-0 ${isWeekend(date) ? 'bg-slate-50/60' : ''} ${BAND_STYLES[band].cell}`}
                      />
                    ))}
                    {items.map((a) => {
                      const aStart = a.start < startIso ? startIso : a.start;
                      const aEnd = a.end > endIso ? endIso : a.end;
                      const offset = isoList.indexOf(aStart);
                      const span = isoList.indexOf(aEnd) - offset + 1;
                      if (offset < 0 || span <= 0) return null;
                      return (
                        <AllocationBar
                          key={a.id}
                          allocation={a}
                          offset={offset}
                          span={span}
                          total={data.days.length}
                        />
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export function PlannerPage() {
  const [view, setView] = useState<ViewMode>('week');
  const [anchor, setAnchor] = useState<string | undefined>(undefined);
  const [department, setDepartment] = useState('All');
  const [data, setData] = useState<PlannerData | null>(null);
  const [conflictsOpen, setConflictsOpen] = useState(false);

  useEffect(() => {
    api.planner({ weekStart: anchor, view, department: department === 'All' ? undefined : department }).then(setData);
  }, [anchor, view, department]);

  const step = VIEW_STEP[view];

  const shift = (dir: -1 | 1) => {
    const base = data?.anchor ?? new Date().toISOString().slice(0, 10);
    setAnchor(addDays(base, dir * step));
  };

  const goToday = () => setAnchor(undefined);

  const dayCount = data?.days.length ?? 7;

  if (!data) return <p className="text-slate-500">Loading resource planner…</p>;

  return (
    <div className="max-w-[1800px] mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">Planning</p>
          <h1 className="text-2xl font-bold text-navy">Resource Planner</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-2xl">
            Capacity, allocations, and conflicts across every inspector. Color bands show daily utilization; bars span job and leave windows.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 bg-white p-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-xs rounded-md capitalize ${view === v ? 'bg-teal/10 text-navy font-medium' : 'text-slate-600 hover:bg-slate-50'}`}
              >
                {v}
              </button>
            ))}
          </div>
          <select
            className="input h-9 w-44 text-xs"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
          >
            {data.departments.map((d) => (
              <option key={d} value={d}>{d === 'All' ? 'All departments' : d}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard
          label="Utilization"
          value={`${data.capacity.utilization}%`}
          sub={`${data.capacity.booked}h booked of ${data.capacity.totalCapacity}h`}
        />
        <KpiCard
          label="Available"
          value={`${data.capacity.available}h`}
          sub="Spare capacity in window"
          accent="text-teal"
        />
        <KpiCard
          label="On leave"
          value={`${data.capacity.onLeave}h`}
          sub="Recorded time off"
          accent="text-amber-700"
        />
        <KpiCard
          label="Training"
          value={`${data.capacity.onTraining}h`}
          sub="Courses / recerts"
          accent="text-steel"
        />
        <KpiCard
          label="Conflicts"
          value={data.conflicts.length}
          sub={data.conflicts.length ? 'View & resolve →' : 'Schedule is clean'}
          accent={data.conflicts.length ? 'text-red-600' : 'text-teal'}
          onClick={() => setConflictsOpen(true)}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className="btn-secondary text-sm px-3" onClick={() => shift(-1)}>←</button>
        <button type="button" className="btn-secondary text-sm min-w-[240px]" onClick={goToday}>
          {fmtRange(data.weekStart, dayCount)}
        </button>
        <button type="button" className="btn-secondary text-sm px-3" onClick={() => shift(1)}>→</button>
        <div className="ml-auto flex flex-wrap items-center gap-3 text-[11px]">
          {(Object.keys(BAND_STYLES) as (keyof typeof BAND_STYLES)[]).map((b) => (
            <div key={b} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${BAND_STYLES[b].dot}`} />
              <span className="text-slate-500">{BAND_STYLES[b].label}</span>
            </div>
          ))}
        </div>
      </div>

      <TimelineGrid data={data} />

      {conflictsOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={() => setConflictsOpen(false)}>
          <div className="card max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-6 border-b border-slate-100">
              <h2 className="text-lg font-semibold text-navy">Detected conflicts ({data.conflicts.length})</h2>
              <p className="text-sm text-slate-500 mt-1">Scheduling clashes in the current window.</p>
            </div>
            <div className="overflow-y-auto p-4 space-y-2 flex-1">
              {data.conflicts.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-8">No conflicts — schedule is clean.</p>
              ) : (
                data.conflicts.map((c, i) => (
                  <div key={i} className="border border-slate-200 rounded-lg p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-sm text-navy">{c.inspectorName}</span>
                      <span className="badge bg-slate-100">{c.date}</span>
                      <span className={`badge border ${conflictClass(c.type)}`}>{conflictLabel(c.type)}</span>
                    </div>
                    <p className="text-xs text-slate-600 mt-1">{c.detail}</p>
                    <Link to={`/inspectors/${c.inspectorId}`} className="text-xs text-teal hover:underline mt-2 inline-block">
                      View inspector →
                    </Link>
                  </div>
                ))
              )}
            </div>
            <div className="p-4 border-t border-slate-100">
              <button type="button" className="btn-secondary" onClick={() => setConflictsOpen(false)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
