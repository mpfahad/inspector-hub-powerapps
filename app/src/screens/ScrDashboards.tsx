import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnDefault, Gallery, KpiTile, ProgressBar, theme } from '../components/controls';
import { getList } from '../powerplatform/connector';
import { deptLoad, heatmap, heatmapDays, leaderboard, seedKpis, utilizationSeries } from '../powerplatform/seedData';

type DashboardTab = 'Executive' | 'Utilization' | 'Productivity' | 'Compliance';

function heatColor(v: number): string {
  if (v >= 90) return '#fde7e9';
  if (v >= 75) return '#fff4ce';
  if (v >= 55) return '#b3e0e8';
  if (v >= 30) return '#e8e6f0';
  return '#f3f2f1';
}

export function ScrDashboards() {
  const [tab, setTab] = useState<DashboardTab>('Executive');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState('');
  const jobs = getList('Jobs');
  const inspectors = getList('Inspectors');

  const activeJobs = useMemo(() => jobs.filter((j) => j.Status === 'In Progress' || j.Status === 'Scheduled').length, [jobs]);

  const openDrillDown = (title: string) => {
    setDrawerTitle(title);
    setDrawerOpen(true);
  };

  const maxUtil = Math.max(...utilizationSeries.map((u) => u.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Executive Dashboards" />
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: theme.spacing.lg, flexWrap: 'wrap' }}>
          {(['Executive', 'Utilization', 'Productivity', 'Compliance'] as DashboardTab[]).map((t) => (
            <BtnDefault
              key={t}
              onClick={() => setTab(t)}
              style={{ background: tab === t ? theme.colors.navActive : theme.colors.surface, fontWeight: tab === t ? 600 : 400 }}
            >
              {t}
            </BtnDefault>
          ))}
        </div>

        {tab === 'Executive' && (
          <>
            <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.lg }}>
              <div onClick={() => openDrillDown('Utilization detail')} style={{ cursor: 'pointer', flex: 1, minWidth: 140 }}>
                <KpiTile label="Avg Utilization" value={`${seedKpis.utilization}%`} sub="Click to drill down" />
              </div>
              <div onClick={() => openDrillDown('Open jobs')} style={{ cursor: 'pointer', flex: 1, minWidth: 140 }}>
                <KpiTile label="Open Jobs" value={seedKpis.openJobs} sub={`${activeJobs} in current data`} />
              </div>
              <KpiTile label="Active Inspectors" value={seedKpis.activeInspectors} />
              <KpiTile label="Acceptance Rate" value={`${seedKpis.acceptanceRate}%`} />
              <KpiTile label="Expiring Certs" value={seedKpis.expiringCerts} sub="next 30d" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing.lg }}>
              <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
                <h3 style={{ marginTop: 0 }}>Weekly utilization</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 160 }}>
                  {utilizationSeries.map((u) => (
                    <div key={u.day} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ height: 120, display: 'flex', alignItems: 'flex-end' }}>
                        <div style={{ width: '100%', height: `${(u.value / maxUtil) * 100}%`, background: theme.colors.accent, borderRadius: '4px 4px 0 0' }} />
                      </div>
                      <div style={{ fontSize: 11, marginTop: 4 }}>{u.day}</div>
                    </div>
                  ))}
                </div>
              </section>
              <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
                <h3 style={{ marginTop: 0 }}>Department load</h3>
                {deptLoad.map((d) => (
                  <div key={d.dept} style={{ marginBottom: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span>{d.dept}</span><span>{d.load}%</span>
                    </div>
                    <ProgressBar value={d.load} />
                  </div>
                ))}
              </section>
            </div>
          </>
        )}

        {tab === 'Utilization' && (
          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
            <h3 style={{ marginTop: 0 }}>Resource utilisation heatmap</h3>
            <p style={{ fontSize: 12, color: theme.colors.textSecondary }}>Power BI recommended for production; simplified grid for Canvas reference.</p>
            <table style={{ borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
              <thead>
                <tr>
                  <th style={{ padding: 8 }}>Dept</th>
                  {heatmapDays.map((d) => <th key={d} style={{ padding: 8 }}>{d}</th>)}
                </tr>
              </thead>
              <tbody>
                {Object.entries(heatmap).map(([dept, vals]) => (
                  <tr key={dept}>
                    <td style={{ padding: 8, fontWeight: 600 }}>{dept}</td>
                    {vals.map((v, i) => (
                      <td key={i} style={{ padding: 8, textAlign: 'center', background: heatColor(v) }}>{v}%</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        )}

        {tab === 'Productivity' && (
          <section>
            <h3 style={{ fontSize: 16 }}>Inspector productivity leaderboard</h3>
            <Gallery
              items={leaderboard.map((l, i) => ({ ...l, ID: i + 1 }))}
              template={(row) => {
                const l = row as (typeof leaderboard)[0] & { ID: number };
                return (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <div>
                      <strong>#{l.ID} {l.name}</strong>
                      <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>{l.dept} · {l.jobs} jobs · {l.hours}h</div>
                    </div>
                    <div style={{ fontWeight: 700, color: theme.colors.primary }}>{l.score}</div>
                  </div>
                );
              }}
            />
          </section>
        )}

        {tab === 'Compliance' && (
          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius }}>
            <h3 style={{ marginTop: 0 }}>Certification compliance</h3>
            <p style={{ fontSize: 13 }}>Valid mandatory certs: <strong>88%</strong> · Expiring ≤90d: <strong>{seedKpis.expiringCerts}</strong></p>
            <p style={{ fontSize: 12, color: theme.colors.textSecondary }}>Link to scrCompetency for matrix detail.</p>
          </section>
        )}
      </div>

      {drawerOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', display: 'flex', justifyContent: 'flex-end', zIndex: 100 }}>
          <div style={{ width: 360, background: theme.colors.surface, height: '100%', padding: theme.spacing.lg, boxShadow: theme.shadow }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
              <h3 style={{ margin: 0 }}>{drawerTitle}</h3>
              <button type="button" onClick={() => setDrawerOpen(false)} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <p style={{ fontSize: 13, color: theme.colors.textSecondary }}>PowerFx: Navigate to detail screen or show nested gallery (drill-down pattern).</p>
            <Gallery
              items={inspectors.slice(0, 5)}
              template={(insp) => (
                <div>
                  <strong>{insp.Title}</strong>
                  <div style={{ fontSize: 12 }}>Utilization: {insp.Utilization}%</div>
                </div>
              )}
            />
          </div>
        </div>
      )}
    </div>
  );
}
