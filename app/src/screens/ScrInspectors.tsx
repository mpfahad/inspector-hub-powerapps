import { useMemo } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { CmbDropdown, Gallery, StatusBadge, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList } from '../powerplatform/connector';
import { DisplayLookup, Filter } from '../powerplatform/operations';
import type { Inspector } from '../powerplatform/types';

const STATUS_OPTIONS = ['All', 'Active', 'On Leave', 'Training', 'Inactive'];

export function ScrInspectors() {
  const { vars, updateContext, navigate, setVar } = useAppContext();
  const inspectors = getList('Inspectors');
  const departments = getList('Departments');
  const assignments = getList('Assignments');

  const filtered = useMemo(() => {
    if (vars.varFilterInspectorStatus === 'All') return inspectors;
    return Filter(inspectors, (i) => i.Status === vars.varFilterInspectorStatus, { delegable: true });
  }, [inspectors, vars.varFilterInspectorStatus]);

  const openDetail = (inspector: Inspector) => {
    setVar('varSelectedInspectorId', inspector.ID);
    navigate('scrInspectorDetail');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Inspectors" />
      <div style={{ padding: theme.spacing.lg }}>
        <CmbDropdown
          label="Filter by Status"
          value={vars.varFilterInspectorStatus}
          options={STATUS_OPTIONS}
          onChange={(v) => updateContext({ varFilterInspectorStatus: v })}
        />
        <Gallery
          items={filtered}
          onSelect={openDetail}
          template={(insp) => {
            const activeAssignments = Filter(
              assignments,
              (a) => a.InspectorId === insp.ID && (a.Status === 'Confirmed' || a.Status === 'In Progress'),
              { delegable: true }
            ).length;
            return (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <strong>{insp.Title}</strong>
                  <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>{insp.EmployeeNo} · {DisplayLookup(departments, insp.DepartmentId)}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{insp.BaseLocation}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <StatusBadge status={insp.Status} />
                  <div style={{ fontSize: 11, marginTop: 6 }}>{activeAssignments} active assignment(s)</div>
                </div>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}
