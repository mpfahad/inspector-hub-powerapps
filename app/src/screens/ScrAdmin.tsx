import { useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { ToggleSwitch, theme } from '../components/controls';
import { getList } from '../powerplatform/connector';
import { useRoleGuard } from '../powerplatform/context/AppContext';

const adminSections = [
  { name: 'Users & Roles', desc: 'Manage accounts, role assignments, and department scopes.', count: '82 users' },
  { name: 'Departments', desc: 'Configure inspection groups and managers.', count: '5 active' },
  { name: 'Permissions', desc: 'Fine-tune the role/permission matrix per entity.', count: '4 roles' },
  { name: 'Authentication', desc: 'SSO, MFA — Azure AD in production.', count: 'M365 SSO' },
  { name: 'Notifications', desc: 'Email and in-app channels, SLA timers.', count: '12 rules' },
  { name: 'Integrations', desc: 'ERP, billing exports, document storage.', count: '3 connected' },
];

const systemToggles = [
  { label: 'Auto-flag assignment SLA breach', default: true, desc: 'Notify coordinator after 24h' },
  { label: 'Cert expiry alerts (60/30/7d)', default: true, desc: 'Email and in-app' },
  { label: 'Block leave with active assignment', default: true, desc: 'Force reassignment first' },
  { label: 'Allow self-approve activity log', default: false, desc: 'Inspector role only' },
  { label: 'Daily digest email', default: true, desc: '08:00 local time' },
];

export function ScrAdmin() {
  const isAdmin = useRoleGuard(['Admin']);
  const clients = getList('Clients');
  const [toggles, setToggles] = useState(systemToggles.map((t) => t.default));

  if (!isAdmin) {
    return (
      <div>
        <ScreenHeader title="Administration" />
        <p style={{ padding: 24, color: theme.colors.danger }}>
          Access denied. PowerFx: If(LookUp(UserRoles, UserEmail = User().Email).Role &lt;&gt; &quot;Admin&quot;, Notify(...))
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Administration" />
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          {adminSections.map((s) => (
            <div key={s.name} style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow, cursor: 'pointer' }}>
              <strong>{s.name}</strong>
              <p style={{ fontSize: 12, color: theme.colors.textSecondary, margin: '8px 0' }}>{s.desc}</p>
              <div style={{ fontSize: 12, color: theme.colors.accent, fontWeight: 600 }}>{s.count}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: theme.spacing.lg }}>
          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
            <h3 style={{ marginTop: 0 }}>Clients</h3>
            <p style={{ fontSize: 12, color: theme.colors.textSecondary }}>SharePoint list: Clients</p>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 12 }}>
              <thead>
                <tr style={{ textAlign: 'left', borderBottom: `1px solid ${theme.colors.border}` }}>
                  <th style={{ padding: 8 }}>Client</th>
                  <th style={{ padding: 8 }}>Contact</th>
                  <th style={{ padding: 8 }}>Projects</th>
                  <th style={{ padding: 8 }}>Jobs</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((c) => (
                  <tr key={c.ID} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                    <td style={{ padding: 8 }}>{c.Title}</td>
                    <td style={{ padding: 8 }}>
                      <div>{c.Contact}</div>
                      <div style={{ fontSize: 11, color: theme.colors.textSecondary }}>{c.Email}</div>
                    </td>
                    <td style={{ padding: 8 }}>{c.ProjectCount}</td>
                    <td style={{ padding: 8 }}>{c.JobCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
            <h3 style={{ marginTop: 0 }}>System settings</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {systemToggles.map((t, i) => (
                <div key={t.label}>
                  <ToggleSwitch
                    label={t.label}
                    checked={toggles[i]}
                    onChange={(v) => setToggles((prev) => prev.map((x, j) => (j === i ? v : x)))}
                  />
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{t.desc}</div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
