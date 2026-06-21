import { useMemo } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { Gallery, StatusBadge, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList } from '../powerplatform/connector';
import { DisplayLookup, Filter, LookUp, Sum } from '../powerplatform/operations';

export function ScrInspectorDetail() {
  const { vars, back } = useAppContext();
  const inspectors = getList('Inspectors');
  const departments = getList('Departments');
  const assignments = getList('Assignments');
  const jobs = getList('Jobs');
  const activityLogs = getList('ActivityLogs');
  const leaveRequests = getList('LeaveRequests');

  const inspector = useMemo(
    () => LookUp(inspectors, (i) => i.ID === vars.varSelectedInspectorId),
    [inspectors, vars.varSelectedInspectorId]
  );

  const inspAssignments = useMemo(
    () => (inspector ? Filter(assignments, (a) => a.InspectorId === inspector.ID, { delegable: true }) : []),
    [assignments, inspector]
  );

  const inspLogs = useMemo(
    () => (inspector ? Filter(activityLogs, (a) => a.InspectorId === inspector.ID, { delegable: true }) : []),
    [activityLogs, inspector]
  );

  const inspLeave = useMemo(
    () => (inspector ? Filter(leaveRequests, (l) => l.InspectorId === inspector.ID, { delegable: true }) : []),
    [leaveRequests, inspector]
  );

  const totalProductive = Sum(inspLogs, (l) => l.ProductiveHours);

  if (!inspector) {
    return (
      <div>
        <ScreenHeader title="Inspector Detail" onBack={back} />
        <p style={{ padding: 24 }}>No inspector selected.</p>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title={inspector.Title ?? 'Inspector'} onBack={back} />
      <div style={{ padding: theme.spacing.lg, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
        <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Profile</h2>
          <p><strong>{inspector.EmployeeNo}</strong></p>
          <p>{DisplayLookup(departments, inspector.DepartmentId)} · {inspector.BaseLocation}</p>
          <StatusBadge status={inspector.Status} />
          <p style={{ marginTop: 16, fontSize: 13 }}>Total productive hours logged: <strong>{totalProductive}</strong></p>
        </section>

        <section>
          <h2 style={{ fontSize: 16 }}>Assignments</h2>
          <Gallery
            items={inspAssignments}
            template={(a) => (
              <div>
                {DisplayLookup(jobs, a.JobId)} — {a.Role} ({a.AllocatedHours}h)
                <div style={{ marginTop: 4 }}><StatusBadge status={a.Status} /></div>
              </div>
            )}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 16 }}>Recent Activity</h2>
          <Gallery
            items={inspLogs.slice(0, 5)}
            template={(log) => (
              <div style={{ fontSize: 13 }}>
                <strong>{log.LogDate}</strong> — {log.ProductiveHours}h productive
                <div style={{ color: theme.colors.textSecondary }}>{log.Narrative}</div>
              </div>
            )}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 16 }}>Leave History</h2>
          <Gallery
            items={inspLeave}
            template={(l) => (
              <div>
                {l.Type}: {l.StartDate} — {l.EndDate} <StatusBadge status={l.Status} />
              </div>
            )}
          />
        </section>
      </div>
    </div>
  );
}
