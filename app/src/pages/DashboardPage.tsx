import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DepartmentOverview, type OperationsDashboardData } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useDepartment, rememberDeptCode } from '../context/DepartmentContext';
import { ActiveAssignmentCard, CompletedAssignmentCard } from '../components/assignments/AssignmentActionCard';

function ProgressBarDept({ value, className = 'bg-teal' }: { value: number; className?: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

/** Home: pick a department — no combined cross-dept KPI strip. */
function DepartmentHomeCards() {
  const [items, setItems] = useState<DepartmentOverview[]>([]);

  useEffect(() => {
    api.departmentsOverview().then(setItems).catch(() => setItems([]));
  }, []);

  const visible = items.filter((d) => d.code.toUpperCase() !== 'HOLD');

  return (
    <div className="max-w-[1200px] mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <h1 className="text-2xl font-bold text-navy">Inspection Hub</h1>
        <p className="text-sm text-slate-500 mt-1">
          Choose a department to open its dashboard and workspace.
        </p>
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-slate-500">No departments available.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {visible.map((d) => (
            <Link
              key={d.id}
              to={`/d/${d.code}`}
              onClick={() => rememberDeptCode(d.code)}
              className="card p-5 hover:shadow-md hover:border-teal/40 transition-all block"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-navy to-steel flex items-center justify-center text-white font-bold text-sm">
                  {d.code.slice(0, 2)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-navy">{d.name}</div>
                  <div className="text-xs text-slate-500">{d.code}</div>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 mb-3">
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-500">Inspectors</div>
                  <div className="text-base font-bold text-navy">{d.inspectorCount}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-500">Active</div>
                  <div className="text-base font-bold text-navy">{d.activeJobs}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-2">
                  <div className="text-[10px] uppercase text-slate-500">Open</div>
                  <div className="text-base font-bold text-navy">{d.openJobs}</div>
                </div>
              </div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs text-slate-500">Workload</span>
                <span
                  className={`text-xs font-semibold ${
                    d.workloadPct > 85
                      ? 'text-red-600'
                      : d.workloadPct > 70
                        ? 'text-amber-700'
                        : 'text-teal'
                  }`}
                >
                  {d.workloadPct}%
                </span>
              </div>
              <ProgressBarDept
                value={d.workloadPct}
                className={
                  d.workloadPct > 85 ? 'bg-red-500' : d.workloadPct > 70 ? 'bg-amber-500' : 'bg-teal'
                }
              />
              <div className="mt-4 text-xs text-teal font-medium">Open dashboard →</div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  to,
  tone = 'navy',
}: {
  label: string;
  value: string | number;
  sub?: string;
  to?: string;
  tone?: 'navy' | 'teal' | 'steel' | 'amber' | 'red';
}) {
  const tones = {
    navy: 'bg-navy/10 text-navy',
    teal: 'bg-teal/10 text-teal',
    steel: 'bg-steel/15 text-steel',
    amber: 'bg-amber-100 text-amber-800',
    red: 'bg-red-100 text-red-700',
  };
  const inner = (
    <div className="card p-5 hover:shadow-md transition-shadow h-full">
      <div className={`h-9 w-9 rounded-lg flex items-center justify-center mb-3 text-sm ${tones[tone]}`}>
        ●
      </div>
      <div className="text-2xl font-bold text-navy">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{label}</div>
      {sub && <div className="text-[11px] text-slate-400 mt-2">{sub}</div>}
    </div>
  );
  return to ? (
    <Link to={to} className="block">
      {inner}
    </Link>
  ) : (
    inner
  );
}

function ProgressBar({ value, className = 'bg-teal' }: { value: number; className?: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div
        className={`h-full rounded-full ${className}`}
        style={{ width: `${Math.min(100, value)}%` }}
      />
    </div>
  );
}

/** Department-scoped operations dashboard (one dept only). */
export function DepartmentDashboardPage() {
  const { department, loading: deptLoading, deptPath } = useDepartment();
  const [data, setData] = useState<OperationsDashboardData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!department) {
      setData(null);
      return;
    }
    setError('');
    api
      .operationsDashboard({ departmentId: department.id })
      .then(setData)
      .catch((err) => {
        setData(null);
        setError(err instanceof Error ? err.message : 'Could not load dashboard');
      });
  }, [department?.id]);

  if (deptLoading || !department) {
    return <p className="text-slate-500">Loading department…</p>;
  }
  if (error) {
    return <p className="text-sm text-red-600 card p-4">{error}</p>;
  }
  if (!data) {
    return <p className="text-slate-500">Loading dashboard…</p>;
  }

  const { kpis, utilizationSeries, upcomingJobs, recentActivity, actionItems } = data;
  const maxUtil = Math.max(...utilizationSeries.map((u) => u.value), 1);
  const avgUtil = Math.round(
    utilizationSeries.reduce((s, u) => s + u.value, 0) / Math.max(1, utilizationSeries.length)
  );

  return (
    <div className="max-w-[1600px] mx-auto space-y-8">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">
          {new Date().toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </p>
        <h1 className="text-2xl font-bold text-navy">Dashboard · {department.name}</h1>
        <p className="text-sm text-slate-500 mt-1">
          Capacity and pipeline for this department only.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          label="Utilization"
          value={`${kpis.utilization}%`}
          sub="This week"
          to={deptPath('planner')}
          tone="teal"
        />
        <StatCard label="Open jobs" value={kpis.openJobs} to={deptPath('jobs')} />
        <StatCard
          label="Active inspectors"
          value={kpis.activeInspectors}
          to={deptPath('inspectors')}
          tone="steel"
        />
        <StatCard label="Active jobs" value={kpis.activeJobs} to={deptPath('jobs')} tone="teal" />
        <StatCard
          label="Expiring certs"
          value={kpis.expiringCerts}
          to={deptPath('competency')}
          tone="red"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="card p-6 xl:col-span-2">
          <h2 className="font-semibold text-navy">Weekly utilization</h2>
          <p className="text-xs text-slate-500 mt-0.5 mb-6">Inspector hours vs standard capacity</p>
          <div className="flex items-end gap-3 h-48 pb-2 border-b border-slate-100">
            {utilizationSeries.map((u) => (
              <div key={u.day} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full flex-1 flex items-end relative">
                  <div
                    className="w-full rounded-t-md bg-gradient-to-t from-navy to-steel"
                    style={{
                      height: `${(u.value / maxUtil) * 100}%`,
                      minHeight: u.value > 0 ? '4px' : 0,
                    }}
                  />
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-teal/50"
                    style={{ bottom: `${(80 / maxUtil) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-slate-500">{u.day}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-6 pt-4 text-sm">
            <div>
              <div className="text-slate-500 text-xs">Avg this week</div>
              <div className="font-semibold text-navy">{avgUtil}%</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Target</div>
              <div className="font-semibold text-navy">80%</div>
            </div>
            <div>
              <div className="text-slate-500 text-xs">Current</div>
              <div className="font-semibold text-navy">{kpis.utilization}%</div>
            </div>
          </div>
        </div>

        <div className="card p-6 bg-gradient-to-br from-white to-slate-50">
          <h2 className="font-semibold text-navy mb-4">Action required</h2>
          {actionItems.length === 0 ? (
            <p className="text-sm text-slate-500">Nothing urgent right now.</p>
          ) : (
            <div className="space-y-3">
              {actionItems.map((a, i) => (
                <div key={i} className="p-3 rounded-lg bg-white border border-slate-200">
                  <div
                    className={`text-[10px] font-semibold mb-1 ${
                      a.type === 'CERT' ? 'text-red-600' : 'text-amber-700'
                    }`}
                  >
                    {a.type}
                  </div>
                  <div className="text-sm font-medium text-navy">{a.title}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{a.detail}</div>
                  {a.link && (
                    <Link
                      to={deptPath(a.link)}
                      className="text-xs text-teal hover:underline mt-2 inline-block"
                    >
                      Open →
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="card p-6 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-navy">Active & upcoming jobs</h2>
              <p className="text-xs text-slate-500">Pipeline snapshot for {department.name}</p>
            </div>
            <Link to={deptPath('jobs')} className="text-sm text-teal">
              View all →
            </Link>
          </div>
          <div className="divide-y divide-slate-100">
            {upcomingJobs.length === 0 ? (
              <p className="text-sm text-slate-500 py-4">No active jobs.</p>
            ) : (
              upcomingJobs.map((j) => (
                <Link
                  key={j.id}
                  to={deptPath(`jobs/${j.id}`)}
                  className="flex items-center gap-4 py-3 hover:bg-slate-50/50 -mx-2 px-2 rounded-lg"
                >
                  <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-steel">
                    📋
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-navy truncate">{j.title}</div>
                    <div className="text-xs text-slate-500">
                      {j.ref} · {j.client} · {j.startDate} → {j.endDate}
                    </div>
                  </div>
                  <div className="hidden md:block w-24 shrink-0">
                    <div className="text-xs text-slate-500 mb-1">
                      {j.assigned}/{j.required} assigned
                    </div>
                    <ProgressBar value={(j.assigned / Math.max(1, j.required)) * 100} />
                  </div>
                  <span className="badge bg-teal/10 text-teal shrink-0">{j.status}</span>
                </Link>
              ))
            )}
          </div>
        </div>

        <div className="card p-6 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-semibold text-navy">Recent activity logs</h2>
              <p className="text-xs text-slate-500">Latest field entries in this department</p>
            </div>
          </div>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-slate-500">No activity logged yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
                  <th className="pb-2 font-semibold">Job</th>
                  <th className="pb-2 font-semibold">Inspector</th>
                  <th className="pb-2 font-semibold">Date</th>
                  <th className="pb-2 font-semibold">Hours</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {recentActivity.map((l) => (
                  <tr key={l.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5">
                      <div className="font-medium text-navy">{l.jobRef}</div>
                      <div className="text-xs text-slate-500 truncate max-w-[200px]">{l.jobTitle}</div>
                    </td>
                    <td className="py-2.5 text-slate-600">{l.inspector}</td>
                    <td className="py-2.5 text-slate-500">{l.logDate}</td>
                    <td className="py-2.5 font-medium">{l.hours}h</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function InspectorKpiCard({
  to,
  label,
  value,
  highlight,
}: {
  to: string;
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <Link
      to={to}
      className={`card block p-5 hover:border-teal/50 hover:shadow-md transition-all ${
        highlight && value > 0 ? 'ring-2 ring-amber-300 border-amber-200' : ''
      }`}
    >
      <div className="text-3xl font-bold text-navy">{value}</div>
      <div className="text-sm text-slate-500 mt-1">{label}</div>
      <div className="text-xs text-teal mt-2">View details →</div>
    </Link>
  );
}

function InspectorDashboard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.inspectorDashboard>> | null>(null);
  const [error, setError] = useState('');

  const load = () =>
    api
      .inspectorDashboard()
      .then((d) => {
        setData(d);
        setError('');
      })
      .catch((err) => {
        setData({
          counts: { activeJobs: 0, completedJobs: 0 },
          activeJobs: [],
          recentCompleted: [],
        });
        setError(err instanceof Error ? err.message : 'Failed to load dashboard');
      });

  useEffect(() => {
    load();
  }, []);

  if (!data) return <p>Loading dashboard…</p>;

  const { counts, activeJobs, recentCompleted } = data;

  return (
    <div className="max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">My Dashboard</h1>
        <p className="text-sm text-slate-500 mt-1">Assigned jobs and active work at a glance</p>
      </div>

      {error && <p className="text-sm text-red-600 card p-4">{error}</p>}

      <div className="grid grid-cols-2 gap-4">
        <InspectorKpiCard to="/jobs" label="Active jobs" value={counts.activeJobs} />
        <InspectorKpiCard to="/jobs#completed" label="Completed jobs" value={counts.completedJobs} />
      </div>

      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-navy">Active jobs</h2>
          {activeJobs.length > 0 && (
            <span className="badge bg-teal/10 text-teal">{activeJobs.length} in progress</span>
          )}
        </div>
        {activeJobs.length === 0 ? (
          <div className="card p-5 text-sm text-slate-500">No active jobs.</div>
        ) : (
          <div className="space-y-4">
            {activeJobs.map((a) => (
              <ActiveAssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </section>

      {recentCompleted.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-navy">Recent completed</h2>
            <Link to="/jobs#completed" className="text-sm text-teal">
              View all →
            </Link>
          </div>
          <div className="space-y-4">
            {recentCompleted.map((a) => (
              <CompletedAssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        </section>
      )}

      <Link to="/jobs#timesheet" className="card block p-5 hover:border-teal/50 transition-colors">
        <div className="font-semibold text-navy">Generate timesheet</div>
        <p className="text-sm text-slate-500 mt-1">Download a PDF for any period</p>
      </Link>
    </div>
  );
}

/** Staff home = department picker. Inspectors keep personal dashboard. */
export function DashboardPage() {
  const { user } = useAuth();
  if (user?.role === 'Inspector') return <InspectorDashboard />;
  return <DepartmentHomeCards />;
}
