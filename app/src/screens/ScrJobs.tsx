import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnDefault, BtnPrimary, CmbDropdown, Gallery, StatusBadge, TxtInput, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList, patchNew } from '../powerplatform/connector';
import { DisplayLookup, Filter, Sort } from '../powerplatform/operations';
import type { Job } from '../powerplatform/types';

const STATUS_OPTIONS = ['All', 'Draft', 'Scheduled', 'In Progress', 'Completed', 'Cancelled'];

export function ScrJobs() {
  const { vars, updateContext, navigate, setVar } = useAppContext();
  const [showForm, setShowForm] = useState(false);
  const [draft, setDraft] = useState({ Title: '', Scope: '', Status: 'Draft' as Job['Status'], Priority: 'Medium' as Job['Priority'], ClientId: '1', DepartmentId: '1', StartDate: '', EndDate: '' });

  const clients = getList('Clients');
  const departments = getList('Departments');
  const jobs = getList('Jobs');

  const filteredJobs = useMemo(() => {
    // PowerFx: Sort(Filter(Jobs, varFilterJobStatus = "All" || Status = varFilterJobStatus), StartDate, Descending)
    let result = jobs;
    if (vars.varFilterJobStatus !== 'All') {
      result = Filter(result, (j) => j.Status === vars.varFilterJobStatus, { delegable: true });
    }
    return Sort(result, (j) => j.StartDate, true);
  }, [jobs, vars.varFilterJobStatus]);

  const openDetail = (job: Job) => {
    setVar('varSelectedJobId', job.ID);
    updateContext({ varFormMode: 'View' });
    navigate('scrJobDetail');
  };

  const saveNewJob = () => {
    // PowerFx: Patch(Jobs, Defaults(Jobs), { Title: txtRef.Text, Client: { Id: cmbClient.Selected.ID }, ... }); Notify("Saved"); Navigate(scrJobs)
    patchNew('Jobs', { Status: 'Draft', Priority: 'Medium' }, {
      Title: draft.Title,
      Scope: draft.Scope,
      Status: draft.Status,
      Priority: draft.Priority,
      ClientId: Number(draft.ClientId),
      DepartmentId: Number(draft.DepartmentId),
      StartDate: draft.StartDate,
      EndDate: draft.EndDate,
    });
    setShowForm(false);
    setDraft({ Title: '', Scope: '', Status: 'Draft', Priority: 'Medium', ClientId: '1', DepartmentId: '1', StartDate: '', EndDate: '' });
    updateContext({ varStatusMessage: 'Job created (Patch to SharePoint Jobs list)' });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Jobs" />
      <div style={{ padding: theme.spacing.lg, display: 'flex', gap: theme.spacing.lg, flex: 1 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.md, alignItems: 'flex-end' }}>
            <CmbDropdown
              label="Filter by Status"
              value={vars.varFilterJobStatus}
              options={STATUS_OPTIONS}
              onChange={(v) => updateContext({ varFilterJobStatus: v, varGalleryPage: 0 })}
            />
            <BtnPrimary onClick={() => { updateContext({ varFormMode: 'New' }); setShowForm(true); }}>+ New Job</BtnPrimary>
          </div>

          {vars.varStatusMessage && (
            <div style={{ padding: 8, background: '#dff6dd', borderRadius: 4, marginBottom: 12, fontSize: 13 }}>
              {vars.varStatusMessage}
            </div>
          )}

          <Gallery
            items={filteredJobs}
            onSelect={openDetail}
            template={(job) => (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <strong>{job.Title}</strong>
                  <StatusBadge status={job.Priority} />
                </div>
                <div style={{ fontSize: 12, color: theme.colors.textSecondary }}>
                  {DisplayLookup(clients, job.ClientId)} · {DisplayLookup(departments, job.DepartmentId)}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                  <StatusBadge status={job.Status} />
                  <span style={{ fontSize: 12 }}>{job.StartDate} — {job.EndDate}</span>
                </div>
              </div>
            )}
          />
        </div>

        {showForm && (
          <div style={{ width: 320, background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow, alignSelf: 'flex-start' }}>
            <h3 style={{ marginTop: 0 }}>New Job Form</h3>
            <p style={{ fontSize: 11, color: theme.colors.textSecondary }}>PowerFx: frmJob — DefaultMode = New</p>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Job Ref (Title)</span>
              <TxtInput value={draft.Title} onChange={(v) => setDraft({ ...draft, Title: v })} placeholder="JOB-2026-XXXX" />
            </label>
            <CmbDropdown label="Client" value={draft.ClientId} options={clients.map((c) => String(c.ID))} onChange={(v) => setDraft({ ...draft, ClientId: v })} />
            <CmbDropdown label="Department" value={draft.DepartmentId} options={departments.map((d) => String(d.ID))} onChange={(v) => setDraft({ ...draft, DepartmentId: v })} />
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Scope</span>
              <TxtInput value={draft.Scope} onChange={(v) => setDraft({ ...draft, Scope: v })} multiline />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>Start Date</span>
              <TxtInput type="date" value={draft.StartDate} onChange={(v) => setDraft({ ...draft, StartDate: v })} />
            </label>
            <label style={{ display: 'block', marginBottom: 8 }}>
              <span style={{ fontSize: 12, fontWeight: 600 }}>End Date</span>
              <TxtInput type="date" value={draft.EndDate} onChange={(v) => setDraft({ ...draft, EndDate: v })} />
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <BtnPrimary onClick={saveNewJob}>SubmitForm(frmJob)</BtnPrimary>
              <BtnDefault onClick={() => setShowForm(false)}>Cancel</BtnDefault>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
