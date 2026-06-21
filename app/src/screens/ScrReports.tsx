import { ScreenHeader } from '../components/AppShell';
import { BtnDefault, BtnPrimary, KpiTile, ProgressBar, theme } from '../components/controls';
import { deptLoad, reportCatalog, seedKpis, utilizationSeries } from '../powerplatform/seedData';

export function ScrReports() {
  const max = Math.max(...utilizationSeries.map((u) => u.value));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Reports & Analytics" />
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing.lg, marginBottom: theme.spacing.lg }}>
          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
            <h3 style={{ marginTop: 0 }}>Productivity scorecard</h3>
            <p style={{ fontSize: 12, color: theme.colors.textSecondary }}>Trailing 30 days · all departments</p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, margin: '16px 0' }}>
              <KpiTile label="Utilization" value={`${seedKpis.utilization}%`} />
              <KpiTile label="Acceptance" value={`${seedKpis.acceptanceRate}%`} />
              <KpiTile label="On-time logs" value="96%" />
              <KpiTile label="Compliance" value="88%" />
            </div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height: 120, borderTop: `1px solid ${theme.colors.border}`, paddingTop: 12 }}>
              {utilizationSeries.map((u) => (
                <div key={u.day} style={{ flex: 1, textAlign: 'center' }}>
                  <div style={{ height: 80, display: 'flex', alignItems: 'flex-end' }}>
                    <div style={{ width: '100%', height: `${(u.value / max) * 100}%`, background: '#0f4c5c', borderRadius: '3px 3px 0 0' }} />
                  </div>
                  <div style={{ fontSize: 10, marginTop: 4 }}>{u.day}</div>
                </div>
              ))}
            </div>
          </section>

          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
            <h3 style={{ marginTop: 0 }}>Department load</h3>
            {deptLoad.map((d) => (
              <div key={d.dept} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                  <span>{d.dept}</span><span>{d.load}%</span>
                </div>
                <ProgressBar value={d.load} />
              </div>
            ))}
          </section>
        </div>

        <h3 style={{ fontSize: 14, color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>Operational reports</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: theme.spacing.md, marginTop: 12 }}>
          {reportCatalog.map((r) => (
            <div key={r.name} style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
              <strong>{r.name}</strong>
              <p style={{ fontSize: 12, color: theme.colors.textSecondary, margin: '8px 0 12px' }}>{r.desc}</p>
              <div style={{ display: 'flex', gap: 8 }}>
                <BtnDefault>View</BtnDefault>
                <BtnPrimary>Export CSV</BtnPrimary>
              </div>
              <div style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 8 }}>
                Canvas: Power Automate → Export to Excel / PDF
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
