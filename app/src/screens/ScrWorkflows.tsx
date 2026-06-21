import { useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnDefault, Gallery, theme } from '../components/controls';
import { seedApprovals, seedWorkflows } from '../powerplatform/seedData';

const sevColor: Record<string, string> = {
  info: '#e8f4fd',
  success: '#dff6dd',
  warn: '#fff4ce',
  critical: '#fde7e9',
};

export function ScrWorkflows() {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = seedWorkflows.find((w) => w.ID === selectedId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Workflow Automation" />
      <div style={{ padding: theme.spacing.lg }}>
        <p style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: theme.spacing.md }}>
          Production: implement each row as a <strong>Power Automate</strong> cloud flow. Canvas app triggers via button or SharePoint item events.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
          <section>
            <h2 style={{ fontSize: 16 }}>Notification templates</h2>
            <Gallery
              items={seedWorkflows}
              selectedId={selectedId ?? undefined}
              onSelect={(w) => setSelectedId(w.ID)}
              template={(w) => (
                <div style={{ background: sevColor[w.Severity] }}>
                  <strong>{w.Title}</strong>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{w.Trigger}</div>
                  <div style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 4 }}>
                    {w.Channels} · {w.Timing}
                  </div>
                </div>
              )}
            />
          </section>

          <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
            {selected ? (
              <>
                <h3 style={{ marginTop: 0 }}>{selected.Title}</h3>
                <dl style={{ fontSize: 13 }}>
                  <dt style={{ fontWeight: 600 }}>Trigger</dt>
                  <dd>{selected.Trigger}</dd>
                  <dt style={{ fontWeight: 600, marginTop: 8 }}>Audience</dt>
                  <dd>{selected.Audience}</dd>
                  <dt style={{ fontWeight: 600, marginTop: 8 }}>Channels</dt>
                  <dd>{selected.Channels}</dd>
                  <dt style={{ fontWeight: 600, marginTop: 8 }}>Timing</dt>
                  <dd>{selected.Timing}</dd>
                </dl>
                <BtnDefault>Open in Power Automate</BtnDefault>
              </>
            ) : (
              <p style={{ color: theme.colors.textSecondary }}>Select a notification template</p>
            )}
          </section>
        </div>

        <h2 style={{ fontSize: 16, marginTop: theme.spacing.lg }}>Approval chains</h2>
        <table style={{ width: '100%', background: theme.colors.surface, borderRadius: theme.radius, borderCollapse: 'collapse', fontSize: 13, boxShadow: theme.shadow }}>
          <thead>
            <tr style={{ background: theme.colors.background, textAlign: 'left' }}>
              <th style={{ padding: 10 }}>Process</th>
              <th style={{ padding: 10 }}>L1</th>
              <th style={{ padding: 10 }}>L2</th>
              <th style={{ padding: 10 }}>SLA</th>
            </tr>
          </thead>
          <tbody>
            {seedApprovals.map((a) => (
              <tr key={a.process} style={{ borderTop: `1px solid ${theme.colors.border}` }}>
                <td style={{ padding: 10 }}>{a.process}</td>
                <td style={{ padding: 10 }}>{a.l1}</td>
                <td style={{ padding: 10 }}>{a.l2}</td>
                <td style={{ padding: 10 }}>{a.sla}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
