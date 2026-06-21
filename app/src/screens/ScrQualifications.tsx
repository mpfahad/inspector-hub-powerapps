import { ScreenHeader } from '../components/AppShell';
import { Gallery, StatusBadge, theme } from '../components/controls';
import { getList } from '../powerplatform/connector';

export function ScrQualifications() {
  const qualifications = getList('Qualifications');
  const certs = getList('InspectorCerts');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Qualifications & Certifications" />
      <div style={{ padding: theme.spacing.lg, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: theme.spacing.lg }}>
        <section>
          <h2 style={{ fontSize: 16 }}>Qualification catalog</h2>
          <p style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 }}>
            SharePoint list: Qualifications
          </p>
          <Gallery
            items={qualifications}
            template={(q) => (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <strong>{q.Title}</strong>
                  <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>{q.Body} · {q.Category}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700 }}>{q.Holders}</div>
                  <div style={{ fontSize: 10, color: theme.colors.textSecondary }}>holders</div>
                </div>
              </div>
            )}
          />
        </section>

        <section style={{ background: theme.colors.surface, borderRadius: theme.radius, boxShadow: theme.shadow, overflow: 'hidden' }}>
          <div style={{ padding: theme.spacing.md, borderBottom: `1px solid ${theme.colors.border}` }}>
            <h2 style={{ margin: 0, fontSize: 16 }}>Certification register</h2>
            <p style={{ margin: '4px 0 0', fontSize: 12, color: theme.colors.textSecondary }}>SharePoint list: InspectorCerts</p>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: theme.colors.background, textAlign: 'left' }}>
                <th style={{ padding: 10 }}>Inspector</th>
                <th style={{ padding: 10 }}>Certification</th>
                <th style={{ padding: 10 }}>Issued</th>
                <th style={{ padding: 10 }}>Expires</th>
                <th style={{ padding: 10 }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c.ID} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                  <td style={{ padding: 10 }}>{c.InspectorName}</td>
                  <td style={{ padding: 10 }}>{c.CertName}</td>
                  <td style={{ padding: 10, color: theme.colors.textSecondary }}>{c.IssuedOn}</td>
                  <td style={{ padding: 10 }}>{c.ExpiresOn}</td>
                  <td style={{ padding: 10 }}><StatusBadge status={c.Status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ padding: 12, background: '#fde7e9', fontSize: 12, borderTop: `1px solid ${theme.colors.border}` }}>
            <strong>1 expired certification blocking assignments</strong>
            <div style={{ marginTop: 4, color: theme.colors.textSecondary }}>
              Aisha Rahman · ACI Concrete Field Tech expired Nov 14, 2025. Excluded from skill-based matching until renewed.
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
