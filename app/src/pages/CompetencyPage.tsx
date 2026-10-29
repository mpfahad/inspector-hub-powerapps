import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type CompetencyData } from '../lib/api';

function certCellClass(status: string | null) {
  if (!status) return 'bg-slate-50 border-slate-200';
  if (status === 'Valid') return 'bg-teal/20 text-teal border-teal/30';
  if (status === 'Expiring Soon') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-red-100 text-red-700 border-red-200';
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string | number; sub: string; accent?: string }) {
  return (
    <div className="card p-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className={`text-3xl font-bold ${accent ?? 'text-navy'}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

export function CompetencyPage() {
  const [data, setData] = useState<CompetencyData | null>(null);

  useEffect(() => {
    api.competency().then(setData);
  }, []);

  if (!data) return <p className="text-slate-500">Loading competency matrix…</p>;

  const { certifications, inspectors, coverage, expiringList, gaps, stats } = data;

  return (
    <div className="max-w-[1700px] mx-auto space-y-6">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">People</p>
        <h1 className="text-2xl font-bold text-navy">Competency Matrix</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-2xl">
          Certification coverage and expiry status across the workforce — feeds the skill-based assignment engine.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Workforce coverage" value={`${stats.coveragePct}%`} sub={`${inspectors.length} inspectors tracked`} />
        <KpiCard label="Certifications" value={stats.certCount} sub="In catalog" accent="text-steel" />
        <KpiCard label="Expiring ≤ 90 days" value={stats.expiringSoon} sub="Action required" accent="text-amber-700" />
        <KpiCard label="Expired" value={stats.expired} sub="Blocks assignment" accent="text-red-600" />
      </div>

      <div className="card overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-navy">Skills by inspector</h2>
            <p className="text-xs text-slate-500 mt-0.5">Each cell = one certification held</p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-teal/30 border" />Valid</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-amber-100 border" />Expiring</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-red-100 border" />Expired</span>
            <span className="flex items-center gap-1"><span className="h-3 w-3 rounded bg-slate-100 border" />Not held</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                <th className="text-left text-xs uppercase text-slate-500 font-semibold py-3 px-4 sticky left-0 bg-slate-50 z-10 min-w-[180px]">Inspector</th>
                <th className="text-left text-xs uppercase text-slate-500 font-semibold py-3 px-2">Dept</th>
                {certifications.map((c) => (
                  <th key={c.id} className="text-center text-[10px] uppercase text-slate-500 font-semibold py-3 px-1 whitespace-nowrap">
                    {c.code}
                  </th>
                ))}
                <th className="text-center text-xs uppercase text-slate-500 font-semibold py-3 px-2">Held</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {inspectors.map((ins) => {
                const held = ins.certs.filter((c) => c.status !== 'Expired').length;
                return (
                  <tr key={ins.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-4 sticky left-0 bg-white z-10">
                      <Link to={`/inspectors/${ins.id}`} className="font-medium text-navy hover:text-teal text-sm">{ins.name}</Link>
                      <div className="text-[11px] text-slate-400 font-mono">{ins.employeeNo}</div>
                    </td>
                    <td className="py-2.5 px-2 text-xs text-slate-500">{ins.department.replace(' Inspection', '')}</td>
                    {certifications.map((cert) => {
                      const heldCert = ins.certs.find((c) => c.code === cert.code);
                      const status = heldCert?.status ?? null;
                      const title = heldCert
                        ? `${cert.code} · ${status} · expires ${heldCert.expiresOn}`
                        : `${cert.code} · Not held`;
                      return (
                        <td key={cert.id} className="py-2 px-1 text-center" title={title}>
                          <div className={`h-7 w-7 mx-auto rounded-md flex items-center justify-center border text-xs ${certCellClass(status)}`}>
                            {heldCert && status !== 'Expired' ? '✓' : heldCert ? '!' : ''}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-2.5 px-2 text-center">
                      <span className="badge bg-teal/10 text-teal">{held}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="card p-5">
          <h2 className="font-semibold text-navy mb-4">Certification coverage</h2>
          <div className="space-y-3">
            {coverage.map((c) => {
              const pct = inspectors.length ? (c.holders / inspectors.length) * 100 : 0;
              return (
                <div key={c.code}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-medium text-navy">{c.code}</span>
                    <span className="text-slate-500">
                      {c.holders} active{c.expiring > 0 && <span className="text-amber-700"> · {c.expiring} expiring</span>}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    <div className="bg-gradient-to-r from-navy to-steel h-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-navy">Expiry watchlist</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sorted by urgency</p>
          </div>
          <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
            {expiringList.length === 0 ? (
              <p className="text-sm text-slate-500 p-5">No expiring or expired certifications.</p>
            ) : (
              expiringList.map((e, i) => (
                <div key={i} className="px-5 py-3 flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${e.status === 'Expired' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                    !
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-navy truncate">{e.inspector} · <span className="text-slate-500 font-normal">{e.code}</span></div>
                    <div className="text-xs text-slate-500">{e.department} · expires {e.expires}</div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-sm font-bold ${e.days < 0 ? 'text-red-600' : 'text-amber-700'}`}>
                      {e.days < 0 ? `${Math.abs(e.days)}d ago` : `${e.days}d`}
                    </div>
                    <span className="badge bg-slate-100 text-[10px]">{e.status}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {gaps.length > 0 && (
        <div className="card p-5 border-amber-200 bg-amber-50/50">
          <h2 className="font-semibold text-navy text-sm">Certification gaps</h2>
          <p className="text-xs text-slate-600 mt-1 mb-3">Fewer than 2 active holders — risk for skill-based assignment.</p>
          <div className="flex flex-wrap gap-2">
            {gaps.map((g) => (
              <span key={g.code} className="text-xs px-2.5 py-1 rounded-md bg-white border border-amber-200 font-medium">
                {g.code} <span className="text-slate-500">· {g.holders} holder{g.holders === 1 ? '' : 's'}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
