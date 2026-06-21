import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { CmbDropdown, theme } from '../components/controls';
import { getList } from '../powerplatform/connector';
import { allocationsForDay, bandColors, dayLoad, detectConflicts, rangeDays } from '../powerplatform/scheduler';
import { DisplayLookup } from '../powerplatform/operations';

const DEPT_FILTER = ['All', 'Mechanical Inspection', 'Electrical Inspection', 'Civil Inspection', 'HSE Inspection', 'NDT Inspection'];

export function ScrPlanner() {
  const [deptFilter, setDeptFilter] = useState('All');
  const inspectors = getList('Inspectors');
  const departments = getList('Departments');
  const weekDates = useMemo(() => rangeDays('2026-06-10', 7), []);
  const conflicts = useMemo(() => detectConflicts(), []);

  const filtered = useMemo(() => {
    if (deptFilter === 'All') return inspectors.filter((i) => i.Status === 'Active' || i.Status === 'On Leave');
    const dept = departments.find((d) => d.Title === deptFilter);
    return inspectors.filter((i) => i.DepartmentId === dept?.ID);
  }, [inspectors, departments, deptFilter]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Resource Planner" />
      <div style={{ padding: theme.spacing.lg }}>
        <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.md, alignItems: 'flex-end' }}>
          <CmbDropdown label="Department" value={deptFilter} options={DEPT_FILTER} onChange={setDeptFilter} />
          {conflicts.length > 0 && (
            <div style={{ padding: '8px 12px', background: '#fde7e9', borderRadius: 4, fontSize: 13 }}>
              {conflicts.length} conflict(s) detected — PowerFx: colConflicts from ForAll loop
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 11 }}>
          {(Object.keys(bandColors) as Array<keyof typeof bandColors>).map((b) => (
            <span key={b} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <span style={{ width: 12, height: 12, background: bandColors[b].bg, borderRadius: 2, border: '1px solid #ccc' }} />
              {bandColors[b].label}
            </span>
          ))}
        </div>

        <div style={{ overflowX: 'auto', background: theme.colors.surface, borderRadius: theme.radius, boxShadow: theme.shadow }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ padding: 10, textAlign: 'left', borderBottom: `1px solid ${theme.colors.border}` }}>Inspector</th>
                {weekDates.map((d) => (
                  <th key={d} style={{ padding: 10, textAlign: 'center', borderBottom: `1px solid ${theme.colors.border}`, minWidth: 90 }}>{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((insp) => (
                <tr key={insp.ID}>
                  <td style={{ padding: 10, borderBottom: `1px solid ${theme.colors.border}`, fontWeight: 600 }}>
                    {insp.Title}
                    <div style={{ fontWeight: 400, fontSize: 10, color: theme.colors.textSecondary }}>{DisplayLookup(departments, insp.DepartmentId)}</div>
                  </td>
                  {weekDates.map((date) => {
                    const load = dayLoad(insp.ID, date);
                    const items = allocationsForDay(insp.ID, date);
                    return (
                      <td key={date} style={{ padding: 4, borderBottom: `1px solid ${theme.colors.border}`, background: bandColors[load.band].bg, verticalAlign: 'top' }}>
                        {load.hours > 0 && <div style={{ fontSize: 10, fontWeight: 600 }}>{load.hours}h</div>}
                        {items.slice(0, 2).map((a) => (
                          <div key={a.id} style={{ fontSize: 9, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={a.title}>
                            {a.kind === 'leave' ? '🏖' : a.kind === 'training' ? '📚' : '💼'} {a.title}
                          </div>
                        ))}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
