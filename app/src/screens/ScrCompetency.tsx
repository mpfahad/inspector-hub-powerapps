import { ScreenHeader } from '../components/AppShell';
import { Gallery, KpiTile, StatusBadge, theme } from '../components/controls';
import { CERT_CATALOG, COMPETENCY, certStatus, competencyStats } from '../powerplatform/competency';

export function ScrCompetency() {
  const { expiringList, catalogSize, workforce } = competencyStats();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Competency Matrix" />
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg, flexWrap: 'wrap' }}>
          <KpiTile label="Certifications tracked" value={catalogSize} />
          <KpiTile label="Workforce" value={workforce} />
          <KpiTile label="Expiring / Expired" value={expiringList.length} sub="Action required" />
        </div>

        <div style={{ overflowX: 'auto', background: theme.colors.surface, borderRadius: theme.radius, boxShadow: theme.shadow, marginBottom: theme.spacing.lg }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11, minWidth: 800 }}>
            <thead>
              <tr style={{ background: theme.colors.background }}>
                <th style={{ padding: 8, textAlign: 'left', position: 'sticky', left: 0, background: theme.colors.background }}>Inspector</th>
                {CERT_CATALOG.map((c) => (
                  <th key={c.code} style={{ padding: 8, textAlign: 'center' }}>{c.code}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPETENCY.map((ins) => (
                <tr key={ins.id}>
                  <td style={{ padding: 8, fontWeight: 600, position: 'sticky', left: 0, background: theme.colors.surface }}>{ins.name}</td>
                  {CERT_CATALOG.map((c) => {
                    const held = ins.certs.find((x) => x.code === c.code);
                    const status = held ? certStatus(held.expires) : null;
                    const bg = !held ? '#f3f2f1' : status === 'Valid' ? '#dff6dd' : status === 'Expiring Soon' ? '#fff4ce' : '#fde7e9';
                    return (
                      <td key={c.code} style={{ padding: 4, textAlign: 'center' }}>
                        <div style={{ width: 24, height: 24, margin: '0 auto', borderRadius: 4, background: bg, border: '1px solid #edebe9', fontSize: 10, lineHeight: '24px' }}>
                          {held ? '✓' : ''}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 style={{ fontSize: 16 }}>Expiring credentials</h2>
        <Gallery
          items={expiringList.map((e, i) => ({ ...e, ID: i + 1 }))}
          template={(e) => {
            const item = e as (typeof expiringList)[0] & { ID: number };
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>{item.inspector} — {item.code}</span>
                <StatusBadge status={item.status} />
              </div>
            );
          }}
          emptyText="No expiring certs"
        />
      </div>
    </div>
  );
}
