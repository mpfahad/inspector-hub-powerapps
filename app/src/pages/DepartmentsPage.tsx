import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type DepartmentOverview } from '../lib/api';

function ProgressBar({ value, className = 'bg-teal' }: { value: number; className?: string }) {
  return (
    <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
      <div className={`h-full rounded-full transition-all ${className}`} style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  );
}

export function DepartmentsPage() {
  const [items, setItems] = useState<DepartmentOverview[]>([]);

  useEffect(() => {
    api.departmentsOverview().then(setItems);
  }, []);

  return (
    <div className="max-w-[1600px] mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">Workspace</p>
        <h1 className="text-2xl font-bold text-navy">Departments</h1>
        <p className="text-sm text-slate-500 mt-1">
          Each inspection group with its inspectors, active jobs, and workload pressure.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {items.map((d) => (
          <div key={d.id} className="card p-6 hover:shadow-md hover:-translate-y-0.5 transition-all">
            <div className="flex items-start gap-3 mb-5">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-navy to-steel flex items-center justify-center text-white font-bold text-sm">
                {d.code.slice(0, 2)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-navy">{d.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">
                  {d.managerEmail ? `Managed by ${d.managerEmail.split('@')[0]}` : 'No manager set'}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-5">
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase text-slate-500 mb-1">Inspectors</div>
                <div className="text-lg font-bold text-navy">{d.inspectorCount}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase text-slate-500 mb-1">Active</div>
                <div className="text-lg font-bold text-navy">{d.activeJobs}</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-[10px] uppercase text-slate-500 mb-1">Open</div>
                <div className="text-lg font-bold text-navy">{d.openJobs}</div>
              </div>
            </div>

            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-navy">Workload pressure</span>
                <span
                  className={`text-xs font-semibold ${
                    d.workloadPct > 85 ? 'text-red-600' : d.workloadPct > 70 ? 'text-amber-700' : 'text-teal'
                  }`}
                >
                  {d.workloadPct}%
                </span>
              </div>
              <ProgressBar
                value={d.workloadPct}
                className={d.workloadPct > 85 ? 'bg-red-500' : d.workloadPct > 70 ? 'bg-amber-500' : 'bg-teal'}
              />
            </div>

            <Link
              to={`/inspectors?dept=${encodeURIComponent(d.name)}`}
              className="btn-secondary w-full text-center block text-sm"
            >
              View inspectors →
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}
