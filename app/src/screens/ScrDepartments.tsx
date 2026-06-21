import { useMemo } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { Gallery, KpiTile, StatusBadge, theme } from '../components/controls';
import { getList } from '../powerplatform/connector';

export function ScrDepartments() {
  const departments = getList('Departments');

  const totalInspectors = useMemo(() => departments.reduce((s, d) => s + (d.InspectorCount ?? 0), 0), [departments]);
  const totalActive = useMemo(() => departments.reduce((s, d) => s + (d.ActiveCount ?? 0), 0), [departments]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Departments" />
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <KpiTile label="Departments" value={departments.length} />
          <KpiTile label="Total Inspectors" value={totalInspectors} />
          <KpiTile label="Active Today" value={totalActive} />
        </div>
        <Gallery
          items={departments}
          template={(d) => (
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <strong>{d.Title}</strong>
                <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>Code: {d.Code} · Manager: {d.ManagerEmail}</div>
              </div>
              <div style={{ textAlign: 'right', fontSize: 13 }}>
                <div>{d.ActiveCount}/{d.InspectorCount} active</div>
                <div style={{ marginTop: 4 }}>
                  <StatusBadge status={d.ActiveCount && d.InspectorCount && d.ActiveCount / d.InspectorCount > 0.7 ? 'Active' : 'Scheduled'} />
                </div>
              </div>
            </div>
          )}
        />
      </div>
    </div>
  );
}
