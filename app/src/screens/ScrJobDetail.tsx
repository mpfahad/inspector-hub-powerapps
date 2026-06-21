import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnPrimary, CmbDropdown, Gallery, StatusBadge, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList, patchExisting, patchNew } from '../powerplatform/connector';
import { DisplayLookup, Filter, LookUp } from '../powerplatform/operations';
import type { Assignment } from '../powerplatform/types';

export function ScrJobDetail() {
  const { vars, back, updateContext } = useAppContext();
  const [assignDraft, setAssignDraft] = useState({ InspectorId: '1', Role: 'Support' as Assignment['Role'], AllocatedHours: '40' });

  const jobs = getList('Jobs');
  const inspectors = getList('Inspectors');
  const clients = getList('Clients');
  const departments = getList('Departments');
  const assignments = getList('Assignments');

  const job = useMemo(
    () => LookUp(jobs, (j) => j.ID === vars.varSelectedJobId),
    [jobs, vars.varSelectedJobId]
  );

  const jobAssignments = useMemo(
    () => (job ? Filter(assignments, (a) => a.JobId === job.ID, { delegable: true }) : []),
    [assignments, job]
  );

  if (!job) {
    return (
      <div>
        <ScreenHeader title="Job Detail" onBack={back} />
        <p style={{ padding: 24 }}>No job selected. Set varSelectedJobId first.</p>
      </div>
    );
  }

  const markComplete = () => {
    patchExisting('Jobs', job, { Status: 'Completed' });
    updateContext({ varStatusMessage: `Job ${job.Title} marked Completed` });
  };

  const addAssignment = () => {
    const inspector = LookUp(inspectors, (i) => i.ID === Number(assignDraft.InspectorId));
    patchNew('Assignments', { Status: 'Proposed', CreatedByEmail: vars.varCurrentUserEmail }, {
      Title: `${job.Title} / ${inspector?.Title ?? 'TBD'}`,
      JobId: job.ID,
      InspectorId: Number(assignDraft.InspectorId),
      Role: assignDraft.Role,
      AllocatedHours: Number(assignDraft.AllocatedHours),
    });
    updateContext({ varStatusMessage: 'Assignment proposed — pending confirmation' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title={job.Title ?? 'Job Detail'} onBack={back} />
      <div style={{ padding: theme.spacing.lg, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
        <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Job Details (View Form)</h2>
          <dl style={{ margin: 0, fontSize: 14 }}>
            <dt style={{ fontWeight: 600, marginTop: 8 }}>Client</dt>
            <dd style={{ margin: '4px 0' }}>{DisplayLookup(clients, job.ClientId)}</dd>
            <dt style={{ fontWeight: 600, marginTop: 8 }}>Department</dt>
            <dd style={{ margin: '4px 0' }}>{DisplayLookup(departments, job.DepartmentId)}</dd>
            <dt style={{ fontWeight: 600, marginTop: 8 }}>Scope</dt>
            <dd style={{ margin: '4px 0' }}>{job.Scope}</dd>
            <dt style={{ fontWeight: 600, marginTop: 8 }}>Dates</dt>
            <dd style={{ margin: '4px 0' }}>{job.StartDate} — {job.EndDate}</dd>
            <dt style={{ fontWeight: 600, marginTop: 8 }}>Status / Priority</dt>
            <dd style={{ margin: '4px 0', display: 'flex', gap: 8 }}>
              <StatusBadge status={job.Status} />
              <StatusBadge status={job.Priority} />
            </dd>
          </dl>
          {vars.varUserRole !== 'Inspector' && (
            <div style={{ marginTop: 16 }}>
              <BtnPrimary onClick={markComplete}>Patch Status → Completed</BtnPrimary>
            </div>
          )}
        </section>

        <section>
          <h2 style={{ fontSize: 16 }}>Assignments Gallery</h2>
          <p style={{ fontSize: 12, color: theme.colors.textSecondary }}>
            PowerFx: Filter(Assignments, JobId = varSelectedJobId)
          </p>
          <Gallery
            items={jobAssignments}
            template={(a) => (
              <div>
                <strong>{DisplayLookup(inspectors, a.InspectorId)}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  {a.Role} · {a.AllocatedHours}h · <StatusBadge status={a.Status} />
                </div>
              </div>
            )}
            emptyText="No inspectors assigned yet"
          />

          {vars.varUserRole !== 'Inspector' && (
            <div style={{ marginTop: 16, background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius }}>
              <h3 style={{ marginTop: 0, fontSize: 14 }}>Assign Inspector</h3>
              <CmbDropdown
                label="Inspector"
                value={assignDraft.InspectorId}
                options={inspectors.filter((i) => i.Status === 'Active').map((i) => String(i.ID))}
                onChange={(v) => setAssignDraft({ ...assignDraft, InspectorId: v })}
              />
              <CmbDropdown label="Role" value={assignDraft.Role} options={['Lead', 'Support', 'Trainee', 'Reviewer']} onChange={(v) => setAssignDraft({ ...assignDraft, Role: v as Assignment['Role'] })} />
              <CmbDropdown label="Hours" value={assignDraft.AllocatedHours} options={['24', '40', '48', '60', '80']} onChange={(v) => setAssignDraft({ ...assignDraft, AllocatedHours: v })} />
              <BtnPrimary onClick={addAssignment}>Patch Assignments</BtnPrimary>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
