import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type ActivityReport, type CostReport, type InspectorPerformanceRow, type OverdueJobsReport, type OverdueTrendPoint, type ProductivityTrendPoint, type ReportOverdueJob, type ReportsData } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/money';

type PeriodKey = 'this_month' | 'last_month' | 'custom';

function periodPresetRange(key: 'this_month' | 'last_month', asOf = new Date()) {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  if (key === 'this_month') {
    const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
    const end = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);
    return { periodStart: iso(start), periodEnd: iso(end), label: 'This month' };
  }
  const start = new Date(asOf.getFullYear(), asOf.getMonth() - 1, 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth(), 0);
  return { periodStart: iso(start), periodEnd: iso(end), label: 'Last month' };
}

type TrendSeries = {
  id: string;
  label: string;
  color: string;
  values: (number | null)[];
  valueSuffix?: string;
};

function trendDirection(values: (number | null)[], invertColors = false) {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length < 2) return { label: 'Insufficient points', className: 'text-slate-400' };
  const first = nums[0];
  const last = nums[nums.length - 1];
  const delta = last - first;
  if (Math.abs(delta) < 0.5) return { label: 'Flat', className: 'text-slate-500' };
  if (delta > 0) {
    return {
      label: `Up ${Math.round(delta)}`,
      className: invertColors ? 'text-red-600' : 'text-teal',
    };
  }
  return {
    label: `Down ${Math.abs(Math.round(delta))}`,
    className: invertColors ? 'text-teal' : 'text-red-600',
  };
}

function TrendLineChart({
  labels,
  series,
  maxHint,
  emptyLabel = 'No trend data for this period.',
}: {
  labels: string[];
  series: TrendSeries[];
  maxHint?: number;
  emptyLabel?: string;
}) {
  if (labels.length === 0 || series.every((s) => s.values.every((v) => v === null))) {
    return <p className="text-sm text-slate-400">{emptyLabel}</p>;
  }

  const width = 640;
  const height = 180;
  const padL = 36;
  const padR = 12;
  const padT = 16;
  const padB = 28;
  const plotW = width - padL - padR;
  const plotH = height - padT - padB;

  const allValues = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
  const maxVal = Math.max(...allValues, maxHint ?? 0, 1);
  const minVal = 0;
  const range = Math.max(maxVal - minVal, 1);
  const n = Math.max(labels.length, 1);

  const xAt = (i: number) => padL + (n === 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const yAt = (v: number) => padT + plotH - ((v - minVal) / range) * plotH;

  const paths = series.map((s) => {
    const pts = s.values
      .map((v, i) => (v === null ? null : { x: xAt(i), y: yAt(v), v, i }))
      .filter((p): p is { x: number; y: number; v: number; i: number } => p !== null);
    if (pts.length === 0) return { ...s, d: '', pts };
    const d = pts.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
    return { ...s, d, pts };
  });

  const gridYs = [0, 0.5, 1].map((t) => ({
    y: padT + plotH * (1 - t),
    label: Math.round(minVal + range * t),
  }));

  return (
    <div>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-44" role="img" aria-label="Trend line chart">
        {gridYs.map((g) => (
          <g key={g.y}>
            <line x1={padL} x2={width - padR} y1={g.y} y2={g.y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 8} y={g.y + 3} textAnchor="end" className="fill-slate-400" fontSize="10">
              {g.label}
            </text>
          </g>
        ))}

        {paths.map((s) => (
          <g key={s.id}>
            {s.d && (
              <path d={s.d} fill="none" stroke={s.color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
            )}
            {s.pts.map((p) => (
              <circle key={`${s.id}-${p.i}`} cx={p.x} cy={p.y} r="3.5" fill={s.color}>
                <title>
                  {s.label}: {p.v}
                  {s.valueSuffix ?? ''} · {labels[p.i]}
                </title>
              </circle>
            ))}
          </g>
        ))}

        {labels.map((label, i) => (
          <text key={`${label}-${i}`} x={xAt(i)} y={height - 8} textAnchor="middle" className="fill-slate-400" fontSize="10">
            {label}
          </text>
        ))}
      </svg>
    </div>
  );
}

function ProductivityTrendChart({ points }: { points?: ProductivityTrendPoint[] }) {
  const series = points ?? [];
  const utilDir = trendDirection(series.map((p) => p.utilizationPct));
  const onTimeDir = trendDirection(series.map((p) => p.onTimeRatePct));

  return (
    <div className="mt-6 pt-5 border-t border-slate-100">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">Weekly productivity trend</h3>
          <p className="text-xs text-slate-500 mt-0.5">Line shows whether utilization and on-time finish are rising or falling</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-navy" /> Utilization
            <span className={`font-medium ${utilDir.className}`}>({utilDir.label})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-teal" /> On-time
            <span className={`font-medium ${onTimeDir.className}`}>({onTimeDir.label})</span>
          </span>
        </div>
      </div>
      <TrendLineChart
        labels={series.map((p) => p.label)}
        maxHint={100}
        series={[
          {
            id: 'utilization',
            label: 'Utilization',
            color: '#1e3a5f',
            values: series.map((p) => p.utilizationPct),
            valueSuffix: '%',
          },
          {
            id: 'ontime',
            label: 'On-time',
            color: '#0d9488',
            values: series.map((p) => p.onTimeRatePct),
            valueSuffix: '%',
          },
        ]}
      />
    </div>
  );
}

function OverdueTrendChart({ points }: { points?: OverdueTrendPoint[] }) {
  const series = points ?? [];
  const totalDir = trendDirection(series.map((p) => p.total), true);
  const activeDir = trendDirection(series.map((p) => p.activeOverdue), true);

  return (
    <div className="mb-5">
      <div className="flex flex-wrap items-end justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-navy">Weekly overdue trend</h3>
          <p className="text-xs text-slate-500 mt-0.5">Line shows whether overdue volume is increasing or decreasing</p>
        </div>
        <div className="flex flex-wrap gap-3 text-[11px] text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-red-600" /> Total overdue
            <span className={`font-medium ${totalDir.className}`}>({totalDir.label})</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded bg-amber-500" /> Active overdue
            <span className={`font-medium ${activeDir.className}`}>({activeDir.label})</span>
          </span>
        </div>
      </div>
      <TrendLineChart
        labels={series.map((p) => p.label)}
        series={[
          {
            id: 'total',
            label: 'Total overdue',
            color: '#dc2626',
            values: series.map((p) => p.total),
          },
          {
            id: 'active',
            label: 'Active overdue',
            color: '#f59e0b',
            values: series.map((p) => p.activeOverdue),
          },
        ]}
      />
    </div>
  );
}

function bandClass(band: InspectorPerformanceRow['band']) {
  if (band === 'overperforming') return 'bg-teal/10 text-teal';
  if (band === 'underperforming') return 'bg-red-100 text-red-700';
  if (band === 'at_risk') return 'bg-amber-100 text-amber-800';
  if (band === 'insufficient_data') return 'bg-slate-100 text-slate-500';
  return 'bg-slate-100 text-slate-700';
}

function bandLabel(band: InspectorPerformanceRow['band']) {
  if (band === 'overperforming') return 'Overperforming';
  if (band === 'underperforming') return 'Underperforming';
  if (band === 'at_risk') return 'At risk';
  if (band === 'insufficient_data') return 'Insufficient data';
  return 'On track';
}

function Scorecard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="text-center p-4 rounded-lg bg-slate-50">
      <div className="text-3xl font-bold text-navy">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[10px] text-slate-400 mt-1">{sub}</div>}
    </div>
  );
}

function InspectorList({
  title,
  description,
  rows,
  empty,
}: {
  title: string;
  description: string;
  rows: InspectorPerformanceRow[];
  empty: string;
}) {
  return (
    <div className="card p-5">
      <h3 className="font-semibold text-navy">{title}</h3>
      <p className="text-xs text-slate-500 mt-1 mb-4">{description}</p>
      {rows.length === 0 ? (
        <p className="text-sm text-slate-400">{empty}</p>
      ) : (
        <div className="space-y-3">
          {rows.map((row) => (
            <Link
              key={row.id}
              to={`/inspectors/${row.id}`}
              className="flex items-start justify-between gap-3 p-3 rounded-lg border border-slate-100 hover:border-teal/30 hover:bg-slate-50 transition-colors"
            >
              <div className="min-w-0">
                <div className="font-medium text-navy">{row.name}</div>
                <div className="text-xs text-slate-500">{row.department} · {row.utilizationPct}% utilization</div>
                {row.highlights.length > 0 && (
                  <div className="text-xs text-slate-400 mt-1">{row.highlights.join(' · ')}</div>
                )}
                {row.bandReason && (
                  <div className="text-[11px] text-slate-400 mt-1 italic">{row.bandReason}</div>
                )}
              </div>
              <span className={`badge shrink-0 ${bandClass(row.band)}`}>{bandLabel(row.band)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PerformanceTable({ rows }: { rows: InspectorPerformanceRow[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <h2 className="font-semibold text-navy">All inspectors</h2>
        <p className="text-xs text-slate-500 mt-0.5">Utilization, schedule adherence, and engagement for the selected period</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Inspector</th>
              <th className="px-3 py-3 font-medium">Band</th>
              <th className="px-3 py-3 font-medium">Utilization</th>
              <th className="px-3 py-3 font-medium">Hours</th>
              <th className="px-3 py-3 font-medium">Work days</th>
              <th className="px-3 py-3 font-medium">Completed</th>
              <th className="px-3 py-3 font-medium">On-time</th>
              <th className="px-3 py-3 font-medium">Overdue</th>
              <th className="px-3 py-3 font-medium">Score</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50">
                <td className="px-5 py-3">
                  <Link to={`/inspectors/${row.id}`} className="font-medium text-navy hover:text-teal">
                    {row.name}
                  </Link>
                  <div className="text-xs text-slate-400">{row.department}</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`badge ${bandClass(row.band)}`}>{bandLabel(row.band)}</span>
                  {row.fullyEngaged && <div className="text-[10px] text-teal mt-1">Fully engaged</div>}
                  {row.bandReason && (
                    <div className="text-[10px] text-slate-400 mt-1 max-w-[180px]">{row.bandReason}</div>
                  )}
                </td>
                <td className="px-3 py-3">{row.utilizationPct}%</td>
                <td className="px-3 py-3">{row.loggedHours}h / {row.allocatedHours}h</td>
                <td className="px-3 py-3">{row.workDaysLogged} / {row.businessDays}</td>
                <td className="px-3 py-3">
                  {row.completedJobs}
                  {row.earlyCompletions > 0 && <span className="text-teal text-xs ml-1">+{row.earlyCompletions} early</span>}
                  {row.lateCompletions > 0 && <span className="text-red-600 text-xs ml-1">{row.lateCompletions} late</span>}
                </td>
                <td className="px-3 py-3">{row.onTimeRatePct !== null ? `${row.onTimeRatePct}%` : '—'}</td>
                <td className="px-3 py-3">{row.overdueActiveJobs || '—'}</td>
                <td className="px-3 py-3 font-semibold text-navy">{row.score}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function overdueTypeLabel(type: ReportOverdueJob['overdueType']) {
  return type === 'active_overdue' ? 'Active overdue' : 'Late completed';
}

type OverdueFilterKey = 'this_month' | 'last_month' | 'custom';
const OVERDUE_PREVIEW_LIMIT = 5;

function ActivityReportCard() {
  const thisMonth = useMemo(() => periodPresetRange('this_month'), []);
  const [filterKey, setFilterKey] = useState<PeriodKey>('this_month');
  const [customStart, setCustomStart] = useState(thisMonth.periodStart);
  const [customEnd, setCustomEnd] = useState(thisMonth.periodEnd);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<ActivityReport | null>(null);

  const period = useMemo(() => {
    if (filterKey === 'custom') {
      const start = customStart <= customEnd ? customStart : customEnd;
      const end = customStart <= customEnd ? customEnd : customStart;
      return { periodStart: start, periodEnd: end, label: 'Custom range' };
    }
    return periodPresetRange(filterKey);
  }, [filterKey, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    api
      .activityReport({ periodStart: period.periodStart, periodEnd: period.periodEnd })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period.periodStart, period.periodEnd]);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-navy">Activity</h2>
          <p className="text-xs text-slate-500 mt-1">
            Who logged hours and narrative on which jobs · {period.label} ({period.periodStart} → {period.periodEnd})
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-slate-100 text-slate-700">{data?.totals.entries ?? 0} entries</span>
          <span className="badge bg-teal/10 text-teal">{data?.totals.hours ?? 0}h</span>
          <span className="badge bg-slate-100 text-slate-700">{data?.totals.inspectors ?? 0} inspectors</span>
        </div>
      </div>
      <div className="flex flex-wrap items-end gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="flex flex-wrap gap-2">
          {(['this_month', 'last_month'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={filterKey === key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
              onClick={() => setFilterKey(key)}
            >
              {periodPresetRange(key).label}
            </button>
          ))}
          <button
            type="button"
            className={filterKey === 'custom' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setFilterKey('custom')}
          >
            Custom range
          </button>
        </div>
        {filterKey === 'custom' && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] text-slate-500">From</label>
              <input type="date" className="input mt-1 text-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">To</label>
              <input type="date" className="input mt-1 text-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}
      </div>
      {loading && !data ? (
        <p className="text-sm text-slate-500">Loading activity…</p>
      ) : !data || data.items.length === 0 ? (
        <p className="text-sm text-slate-500">No activity logs in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2 pr-3 font-medium">Date</th>
                <th className="py-2 pr-3 font-medium">Inspector</th>
                <th className="py-2 pr-3 font-medium">Job</th>
                <th className="py-2 pr-3 font-medium">Hours</th>
                <th className="py-2 font-medium">Narrative</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-b border-slate-50 align-top">
                  <td className="py-2 pr-3 whitespace-nowrap">{String(item.logDate).slice(0, 10)}</td>
                  <td className="py-2 pr-3">
                    <Link to={`/inspectors/${item.inspectorId}`} className="text-teal hover:underline">{item.inspectorName}</Link>
                  </td>
                  <td className="py-2 pr-3">
                    <Link to={`/jobs/${item.jobId}`} className="text-teal hover:underline">{item.jobRef}</Link>
                    <div className="text-xs text-slate-500">{item.jobTitle} · {item.client}</div>
                  </td>
                  <td className="py-2 pr-3 whitespace-nowrap">{item.hours}h</td>
                  <td className="py-2 text-slate-600 max-w-md">{item.narrative ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function CostReportCard() {
  const thisMonth = useMemo(() => periodPresetRange('this_month'), []);
  const [filterKey, setFilterKey] = useState<PeriodKey>('this_month');
  const [customStart, setCustomStart] = useState(thisMonth.periodStart);
  const [customEnd, setCustomEnd] = useState(thisMonth.periodEnd);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<CostReport | null>(null);

  const period = useMemo(() => {
    if (filterKey === 'custom') {
      return { periodStart: customStart, periodEnd: customEnd, label: 'Custom range' };
    }
    return periodPresetRange(filterKey);
  }, [filterKey, customStart, customEnd]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    api
      .costReport({ periodStart: period.periodStart, periodEnd: period.periodEnd })
      .then((r) => {
        if (!cancelled) setData(r);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load cost report');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [period.periodStart, period.periodEnd]);

  return (
    <div className="card p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Cost &amp; margin</h2>
          <p className="text-xs text-slate-500 mt-1">
            Admin only · logged hours × daily CTC (assignment snapshot preferred) vs agreed job price
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['this_month', 'last_month'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={filterKey === key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
              onClick={() => setFilterKey(key)}
            >
              {periodPresetRange(key).label}
            </button>
          ))}
          <button
            type="button"
            className={filterKey === 'custom' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setFilterKey('custom')}
          >
            Custom range
          </button>
        </div>
      </div>
      {filterKey === 'custom' && (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="text-[11px] text-slate-500">From</label>
            <input type="date" className="input mt-1 text-sm" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
          </div>
          <div>
            <label className="text-[11px] text-slate-500">To</label>
            <input type="date" className="input mt-1 text-sm" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        </div>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {loading && !data ? (
        <p className="text-sm text-slate-500">Loading cost report…</p>
      ) : !data ? (
        <p className="text-sm text-slate-500">No cost data.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-lg font-bold text-navy">{data.totals.hours}h</div>
              <div className="text-[11px] text-slate-500">Hours</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-lg font-bold text-navy">{formatMoney(data.totals.costQar)}</div>
              <div className="text-[11px] text-slate-500">Cost (CTC)</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-lg font-bold text-navy">{formatMoney(data.totals.billableQar)}</div>
              <div className="text-[11px] text-slate-500">Billable target</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-lg font-bold text-navy">{formatMoney(data.totals.revenueQar)}</div>
              <div className="text-[11px] text-slate-500">Revenue</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className={`text-lg font-bold ${data.totals.marginQar >= 0 ? 'text-teal' : 'text-red-600'}`}>
                {formatMoney(data.totals.marginQar)}
              </div>
              <div className="text-[11px] text-slate-500">Margin</div>
            </div>
          </div>

          {data.inspectors.length === 0 ? (
            <p className="text-sm text-slate-500">No activity with costable hours in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2 pr-3 font-medium">Inspector</th>
                    <th className="py-2 pr-3 font-medium">Hours</th>
                    <th className="py-2 pr-3 font-medium">Cost</th>
                    <th className="py-2 pr-3 font-medium">Billable</th>
                    <th className="py-2 pr-3 font-medium">Revenue</th>
                    <th className="py-2 font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {data.inspectors.map((row) => (
                    <tr key={row.inspectorId} className="border-b border-slate-50">
                      <td className="py-2 pr-3">
                        <Link to={`/inspectors/${row.inspectorId}`} className="text-teal hover:underline">
                          {row.inspectorName}
                        </Link>
                        <div className="text-xs text-slate-400">{row.employeeNo} · {row.jobs} job(s)</div>
                      </td>
                      <td className="py-2 pr-3">{row.hours}h</td>
                      <td className="py-2 pr-3">{formatMoney(row.costQar)}</td>
                      <td className="py-2 pr-3">{formatMoney(row.billableQar)}</td>
                      <td className="py-2 pr-3">{formatMoney(row.revenueQar)}</td>
                      <td className={`py-2 ${row.marginQar >= 0 ? 'text-teal' : 'text-red-600'}`}>
                        {formatMoney(row.marginQar)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {data.jobs.length > 0 && (
            <details className="text-sm">
              <summary className="cursor-pointer text-slate-600 font-medium">Job-level detail ({data.jobs.length})</summary>
              <div className="overflow-x-auto mt-3">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 border-b border-slate-100">
                    <tr>
                      <th className="py-2 pr-3 font-medium">Job</th>
                      <th className="py-2 pr-3 font-medium">Inspector</th>
                      <th className="py-2 pr-3 font-medium">Hours</th>
                      <th className="py-2 pr-3 font-medium">Cost</th>
                      <th className="py-2 pr-3 font-medium">Revenue</th>
                      <th className="py-2 font-medium">Margin</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.jobs.map((row) => (
                      <tr key={`${row.jobId}-${row.inspectorId}`} className="border-b border-slate-50 align-top">
                        <td className="py-2 pr-3">
                          <Link to={`/jobs/${row.jobId}`} className="text-teal hover:underline">{row.jobRef}</Link>
                          <div className="text-xs text-slate-400">{row.client} · rate: {row.rateSource}</div>
                        </td>
                        <td className="py-2 pr-3">{row.inspectorName}</td>
                        <td className="py-2 pr-3">{row.hours}h</td>
                        <td className="py-2 pr-3">{formatMoney(row.costQar)}</td>
                        <td className="py-2 pr-3">{row.revenueQar != null ? formatMoney(row.revenueQar) : '—'}</td>
                        <td className="py-2">
                          {row.marginQar != null ? formatMoney(row.marginQar) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
          )}
        </>
      )}
    </div>
  );
}

function OverdueJobsCard() {
  const thisMonth = useMemo(() => periodPresetRange('this_month'), []);
  const [filterKey, setFilterKey] = useState<OverdueFilterKey>('this_month');
  const [customStart, setCustomStart] = useState(thisMonth.periodStart);
  const [customEnd, setCustomEnd] = useState(thisMonth.periodEnd);
  const [showAll, setShowAll] = useState(false);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OverdueJobsReport | null>(null);

  const period = useMemo(() => {
    if (filterKey === 'custom') {
      const start = customStart <= customEnd ? customStart : customEnd;
      const end = customStart <= customEnd ? customEnd : customStart;
      return { periodStart: start, periodEnd: end, label: 'Custom range' };
    }
    return periodPresetRange(filterKey);
  }, [filterKey, customStart, customEnd]);

  useEffect(() => {
    setShowAll(false);
    setLoading(true);
    api
      .overdueJobs({ periodStart: period.periodStart, periodEnd: period.periodEnd })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period.periodStart, period.periodEnd]);

  const items = useMemo(() => {
    const rows = data?.items ?? [];
    return [...rows].sort((a, b) => b.plannedEnd.localeCompare(a.plannedEnd) || b.daysLate - a.daysLate);
  }, [data?.items]);
  const visibleItems = showAll ? items : items.slice(0, OVERDUE_PREVIEW_LIMIT);
  const hiddenCount = Math.max(0, items.length - OVERDUE_PREVIEW_LIMIT);

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-navy">Overdue jobs</h2>
          <p className="text-xs text-slate-500 mt-1">
            Active overdue and late-completed jobs · {period.label} ({period.periodStart} → {period.periodEnd})
          </p>
        </div>
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="badge bg-slate-100 text-slate-700">Total {data?.total ?? 0}</span>
          <span className="badge bg-red-100 text-red-700">Active {data?.activeOverdue ?? 0}</span>
          <span className="badge bg-amber-100 text-amber-800">Late completed {data?.lateCompleted ?? 0}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 mb-5 pb-4 border-b border-slate-100">
        <div className="flex flex-wrap gap-2">
          {(['this_month', 'last_month'] as const).map((key) => (
            <button
              key={key}
              type="button"
              className={filterKey === key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
              onClick={() => setFilterKey(key)}
            >
              {periodPresetRange(key).label}
            </button>
          ))}
          <button
            type="button"
            className={filterKey === 'custom' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
            onClick={() => setFilterKey('custom')}
          >
            Custom range
          </button>
        </div>
        {filterKey === 'custom' && (
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="text-[11px] text-slate-500">From</label>
              <input
                type="date"
                className="input mt-1 text-sm"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-500">To</label>
              <input
                type="date"
                className="input mt-1 text-sm"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {!loading && <OverdueTrendChart points={data?.trend} />}

      {loading && !data ? (
        <p className="text-sm text-slate-500">Loading overdue jobs…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-500">No overdue jobs found in this period.</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2 pr-3 font-medium">Ref</th>
                  <th className="py-2 pr-3 font-medium">Title</th>
                  <th className="py-2 pr-3 font-medium">Inspector</th>
                  <th className="py-2 pr-3 font-medium">Planned end</th>
                  <th className="py-2 pr-3 font-medium">Days late</th>
                  <th className="py-2 pr-3 font-medium">Type</th>
                  <th className="py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleItems.map((item) => (
                  <tr key={`${item.jobId}-${item.inspectorId}`} className="border-b border-slate-50">
                    <td className="py-2 pr-3">
                      <Link to={`/jobs/${item.jobId}`} className="text-teal hover:underline">{item.ref}</Link>
                    </td>
                    <td className="py-2 pr-3">
                      <div className="font-medium text-navy">{item.title}</div>
                      <div className="text-xs text-slate-500">{item.client} · {item.department}</div>
                    </td>
                    <td className="py-2 pr-3">
                      <Link to={`/inspectors/${item.inspectorId}`} className="text-teal hover:underline">
                        {item.inspectorName}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{item.plannedEnd}</td>
                    <td className="py-2 pr-3 font-semibold text-red-700">{item.daysLate}</td>
                    <td className="py-2 pr-3">
                      <span
                        className={
                          item.overdueType === 'active_overdue'
                            ? 'badge bg-red-100 text-red-700'
                            : 'badge bg-amber-100 text-amber-800'
                        }
                      >
                        {overdueTypeLabel(item.overdueType)}
                      </span>
                    </td>
                    <td className="py-2">
                      <span className="badge bg-slate-100 text-slate-700">{item.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {hiddenCount > 0 && (
            <div className="mt-4">
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => setShowAll((v) => !v)}
              >
                {showAll ? 'Show latest only' : `Show all (${items.length})`}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const reportCatalog = [
  { name: 'Activity', desc: 'Who logged hours and narrative on which jobs for a selected period.', active: true },
  { name: 'Cost & margin', desc: 'CTC vs agreed job price (Admin only).', active: true, adminOnly: true },
  { name: 'Inspector performance', desc: 'Under/over performers, on-time completion, and full-month engagement.', active: true },
  { name: 'Department workload', desc: 'Coverage ratio and forecast by department.', active: false, link: '/departments' },
  { name: 'Assignment SLA', desc: 'Time-to-assign and reassignment history (planned).', active: false, link: '/jobs' },
  { name: 'Certification compliance', desc: 'Valid, expiring, and expired certifications.', active: false, link: '/competency' },
  { name: 'Leave calendar', desc: 'Approved leave by department.', active: false, link: '/leave' },
  { name: 'Timesheet export', desc: 'Hours per job for billing.', active: false, link: '/jobs#timesheet' },
];

export function ReportsPage() {
  const { user } = useAuth();
  const isAdminUser = user?.role === 'Admin';
  const thisMonth = useMemo(() => periodPresetRange('this_month'), []);
  const [periodKey, setPeriodKey] = useState<PeriodKey>('this_month');
  const [customStart, setCustomStart] = useState(thisMonth.periodStart);
  const [customEnd, setCustomEnd] = useState(thisMonth.periodEnd);
  const [data, setData] = useState<ReportsData | null>(null);
  const [loading, setLoading] = useState(true);

  const period = useMemo(() => {
    if (periodKey === 'custom') {
      const start = customStart <= customEnd ? customStart : customEnd;
      const end = customStart <= customEnd ? customEnd : customStart;
      return { periodStart: start, periodEnd: end, label: 'Custom range' };
    }
    return periodPresetRange(periodKey);
  }, [periodKey, customStart, customEnd]);

  useEffect(() => {
    setLoading(true);
    api
      .reports({ periodStart: period.periodStart, periodEnd: period.periodEnd })
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [period.periodStart, period.periodEnd]);

  if (loading && !data) return <p className="text-slate-500">Loading reports…</p>;
  if (!data) return <p className="text-red-600">Could not load reports.</p>;

  const { scorecard, performance } = data;

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">Insights</p>
          <h1 className="text-2xl font-bold text-navy">Reports & Analytics</h1>
          <p className="text-sm text-slate-500 mt-1">
            Operational KPIs and inspector performance — {period.label} ({data.period.start} → {data.period.end})
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-2">
            {(['this_month', 'last_month'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className={periodKey === key ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
                onClick={() => setPeriodKey(key)}
              >
                {periodPresetRange(key).label}
              </button>
            ))}
            <button
              type="button"
              className={periodKey === 'custom' ? 'btn-primary text-sm' : 'btn-secondary text-sm'}
              onClick={() => setPeriodKey('custom')}
            >
              Custom range
            </button>
          </div>
          {periodKey === 'custom' && (
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-[11px] text-slate-500">From</label>
                <input
                  type="date"
                  className="input mt-1 text-sm"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-500">To</label>
                <input
                  type="date"
                  className="input mt-1 text-sm"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <ActivityReportCard />

      {isAdminUser && <CostReportCard />}

      <div className="card p-6">
        <h2 className="text-base font-semibold text-navy mb-1">Productivity scorecard</h2>
        <p className="text-xs text-slate-500 mb-5">{period.label} · all departments</p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Scorecard label="Utilization" value={`${scorecard.utilization}%`} sub="Avg logged vs capacity" />
          <Scorecard
            label="On-time finish"
            value={scorecard.onTimeLogs !== null ? `${scorecard.onTimeLogs}%` : '—'}
            sub="Jobs closed on or before schedule"
          />
          <Scorecard label="Compliance" value={`${scorecard.compliance}%`} sub="Cert health index" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-4 pt-4 border-t border-slate-100 text-center text-sm">
          <div><span className="font-bold text-teal">{performance.scorecard.overperformingCount}</span> overperforming</div>
          <div><span className="font-bold text-red-600">{performance.scorecard.underperformingCount}</span> underperforming</div>
          <div><span className="font-bold text-amber-700">{performance.scorecard.atRiskCount ?? 0}</span> at risk</div>
          <div><span className="font-bold text-navy">{performance.scorecard.fullyEngagedCount}</span> fully engaged</div>
          <div><span className="font-bold text-navy">{performance.onTimeFinishers.length}</span> rated 100% on-time</div>
        </div>
        <ProductivityTrendChart points={data.productivityTrend} />
      </div>

      <OverdueJobsCard />

      {data.methodology && (
        <div className="card p-6">
          <h2 className="text-base font-semibold text-navy mb-1">Performance rating methodology</h2>
          <p className="text-xs text-slate-500 mb-4">
            Industry-style field-services benchmarks — a single delayed job does not mark someone underperforming.
          </p>
          <ul className="text-sm text-slate-600 space-y-2 list-disc pl-5">
            {data.methodology.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <InspectorList
          title="Overperforming inspectors"
          description="Target utilization (70–85%) or top quartile, strong schedule adherence, no chronic overdue."
          rows={performance.overperforming}
          empty="No inspectors in the overperforming band for this period."
        />
        <InspectorList
          title="Underperforming inspectors"
          description="Requires ≥2 sustained signals (low util, poor on-time %, chronic lateness, or chronic overdue) — not one delay."
          rows={performance.underperforming}
          empty="No underperforming inspectors this period."
        />
        <InspectorList
          title="At risk (watch list)"
          description="Early warning: one minor overdue, below-target utilization, or isolated late close with small sample."
          rows={performance.atRisk ?? []}
          empty="No inspectors on the watch list."
        />
        <InspectorList
          title="Finished on time (rated sample)"
          description="100% on-time or early closes with at least 3 completed jobs in the period."
          rows={performance.onTimeFinishers}
          empty="No inspectors with a rated on-time sample yet."
        />
        <InspectorList
          title="Fully engaged"
          description="≥85% utilization and ≥18 work days logged (leave excluded)."
          rows={performance.fullyEngaged}
          empty="No fully engaged inspectors this period."
        />
      </div>

      <PerformanceTable rows={performance.inspectors} />

      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Related reports</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {reportCatalog
            .filter((r) => !('adminOnly' in r && r.adminOnly) || isAdminUser)
            .map((r) => (
            <div key={r.name} className="card p-5 hover:shadow-md transition-shadow">
              <h4 className="font-semibold text-navy">{r.name}</h4>
              <p className="text-xs text-slate-500 mt-1 leading-relaxed">{r.desc}</p>
              {r.active ? (
                <span className="inline-block mt-3 text-xs text-teal font-medium">Viewing above ↑</span>
              ) : r.link ? (
                <Link to={r.link} className="inline-block mt-3 text-xs text-teal hover:underline">Open related page →</Link>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
