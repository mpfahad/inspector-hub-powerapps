import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnPrimary, CmbDropdown, Gallery, TxtInput, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList, patchNew } from '../powerplatform/connector';
import { DisplayLookup, Sort } from '../powerplatform/operations';

export function ScrActivityLog() {
  const { vars, updateContext } = useAppContext();
  const [draft, setDraft] = useState({
    InspectorId: '1',
    JobId: '1',
    LogDate: '2026-06-21',
    Hours: '8',
    ProductiveHours: '7',
    Narrative: '',
    QualityScore: '90',
  });

  const activityLogs = getList('ActivityLogs');
  const inspectors = getList('Inspectors');
  const jobs = getList('Jobs');

  const recentLogs = useMemo(
    () => Sort(activityLogs, (l) => l.LogDate, true).slice(0, 20),
    [activityLogs]
  );

  const submitLog = () => {
    const inspector = inspectors.find((i) => i.ID === Number(draft.InspectorId));
    // PowerFx: Patch(ActivityLogs, Defaults(ActivityLogs), { Inspector: {...}, Job: {...}, ... })
    patchNew('ActivityLogs', {}, {
      Title: `Log ${draft.LogDate}`,
      InspectorId: Number(draft.InspectorId),
      JobId: Number(draft.JobId),
      LogDate: draft.LogDate,
      Hours: Number(draft.Hours),
      ProductiveHours: Number(draft.ProductiveHours),
      Narrative: draft.Narrative,
      QualityScore: Number(draft.QualityScore),
    });
    setDraft({ ...draft, Narrative: '', Hours: '8', ProductiveHours: '7' });
    updateContext({ varStatusMessage: `Activity log saved for ${inspector?.Title}` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Activity Log" />
      <div style={{ padding: theme.spacing.lg, display: 'grid', gridTemplateColumns: '360px 1fr', gap: theme.spacing.lg }}>
        <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow, alignSelf: 'start' }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>New Activity Entry</h2>
          <p style={{ fontSize: 11, color: theme.colors.textSecondary }}>frmActivityLog — DefaultMode = New</p>
          <CmbDropdown label="Inspector" value={draft.InspectorId} options={inspectors.map((i) => String(i.ID))} onChange={(v) => setDraft({ ...draft, InspectorId: v })} />
          <CmbDropdown label="Job" value={draft.JobId} options={jobs.map((j) => String(j.ID))} onChange={(v) => setDraft({ ...draft, JobId: v })} />
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Log Date</span>
            <TxtInput type="date" value={draft.LogDate} onChange={(v) => setDraft({ ...draft, LogDate: v })} />
          </label>
          <CmbDropdown label="Hours" value={draft.Hours} options={['4', '6', '8', '10', '12']} onChange={(v) => setDraft({ ...draft, Hours: v })} />
          <CmbDropdown label="Productive Hours" value={draft.ProductiveHours} options={['2', '4', '6', '7', '8']} onChange={(v) => setDraft({ ...draft, ProductiveHours: v })} />
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Narrative</span>
            <TxtInput value={draft.Narrative} onChange={(v) => setDraft({ ...draft, Narrative: v })} multiline placeholder="Work completed today..." />
          </label>
          <CmbDropdown label="Quality Score" value={draft.QualityScore} options={['70', '80', '85', '90', '95', '100']} onChange={(v) => setDraft({ ...draft, QualityScore: v })} />
          <BtnPrimary onClick={submitLog}>SubmitForm(frmActivityLog)</BtnPrimary>
        </section>

        <section>
          <h2 style={{ fontSize: 16 }}>Recent Logs</h2>
          {vars.varStatusMessage && (
            <div style={{ padding: 8, background: '#dff6dd', borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{vars.varStatusMessage}</div>
          )}
          <Gallery
            items={recentLogs}
            template={(log) => (
              <div>
                <strong>{log.LogDate}</strong> — {DisplayLookup(inspectors, log.InspectorId)} on {DisplayLookup(jobs, log.JobId)}
                <div style={{ fontSize: 13, marginTop: 4 }}>
                  {log.ProductiveHours}h / {log.Hours}h · Quality: {log.QualityScore}
                </div>
                <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>{log.Narrative}</div>
              </div>
            )}
          />
        </section>
      </div>
    </div>
  );
}
