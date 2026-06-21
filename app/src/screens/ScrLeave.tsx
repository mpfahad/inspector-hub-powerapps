import { useMemo, useState } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnDefault, BtnPrimary, CmbDropdown, Gallery, StatusBadge, TxtInput, theme } from '../components/controls';
import { useAppContext, useRoleGuard } from '../powerplatform/context/AppContext';
import { getList, patchExisting, patchNew } from '../powerplatform/connector';
import { DisplayLookup, Filter } from '../powerplatform/operations';
import type { LeaveRequest } from '../powerplatform/types';

export function ScrLeave() {
  const { vars, updateContext } = useAppContext();
  const canApprove = useRoleGuard(['Admin', 'Manager']);
  const [draft, setDraft] = useState({ InspectorId: '1', Type: 'Annual' as LeaveRequest['Type'], StartDate: '', EndDate: '' });

  const leaveRequests = getList('LeaveRequests');
  const inspectors = getList('Inspectors');

  const pending = useMemo(
    () => Filter(leaveRequests, (l) => l.Status === 'Pending', { delegable: true }),
    [leaveRequests]
  );

  const allRequests = useMemo(
    () => Filter(leaveRequests, () => true, { delegable: true }),
    [leaveRequests]
  );

  const submitLeave = () => {
    const inspector = inspectors.find((i) => i.ID === Number(draft.InspectorId));
    patchNew('LeaveRequests', { Status: 'Pending', ApproverEmail: 'manager@company.com' }, {
      Title: `${draft.Type} — ${inspector?.Title}`,
      InspectorId: Number(draft.InspectorId),
      Type: draft.Type,
      StartDate: draft.StartDate,
      EndDate: draft.EndDate,
    });
    updateContext({ varStatusMessage: 'Leave request submitted — Power Automate would notify approver' });
    setDraft({ InspectorId: '1', Type: 'Annual', StartDate: '', EndDate: '' });
  };

  const decide = (request: LeaveRequest, decision: 'Approved' | 'Rejected') => {
    patchExisting('LeaveRequests', request, { Status: decision, ApproverEmail: vars.varCurrentUserEmail });
    updateContext({ varStatusMessage: `Leave ${decision.toLowerCase()} — update Inspector.Status if Approved` });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Leave Requests" />
      <div style={{ padding: theme.spacing.lg, display: 'grid', gridTemplateColumns: '320px 1fr', gap: theme.spacing.lg }}>
        <section style={{ background: theme.colors.surface, padding: theme.spacing.md, borderRadius: theme.radius, boxShadow: theme.shadow, alignSelf: 'start' }}>
          <h2 style={{ marginTop: 0, fontSize: 16 }}>Request Leave</h2>
          <CmbDropdown label="Inspector" value={draft.InspectorId} options={inspectors.map((i) => String(i.ID))} onChange={(v) => setDraft({ ...draft, InspectorId: v })} />
          <CmbDropdown label="Type" value={draft.Type} options={['Annual', 'Sick', 'Training', 'Other']} onChange={(v) => setDraft({ ...draft, Type: v as LeaveRequest['Type'] })} />
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Start</span>
            <TxtInput type="date" value={draft.StartDate} onChange={(v) => setDraft({ ...draft, StartDate: v })} />
          </label>
          <label style={{ display: 'block', marginBottom: 8 }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>End</span>
            <TxtInput type="date" value={draft.EndDate} onChange={(v) => setDraft({ ...draft, EndDate: v })} />
          </label>
          <BtnPrimary onClick={submitLeave}>Submit Request</BtnPrimary>
        </section>

        <section>
          {vars.varStatusMessage && (
            <div style={{ padding: 8, background: '#dff6dd', borderRadius: 4, marginBottom: 12, fontSize: 13 }}>{vars.varStatusMessage}</div>
          )}

          {canApprove && pending.length > 0 && (
            <>
              <h2 style={{ fontSize: 16 }}>Approval Queue ({pending.length})</h2>
              <p style={{ fontSize: 12, color: theme.colors.textSecondary }}>In production: Power Automate Approval action</p>
              <Gallery
                items={pending}
                template={(req) => (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong>{DisplayLookup(inspectors, req.InspectorId)}</strong> — {req.Type}
                      <div style={{ fontSize: 12 }}>{req.StartDate} to {req.EndDate}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <BtnPrimary onClick={() => decide(req, 'Approved')}>Approve</BtnPrimary>
                      <BtnDefault onClick={() => decide(req, 'Rejected')}>Reject</BtnDefault>
                    </div>
                  </div>
                )}
              />
            </>
          )}

          <h2 style={{ fontSize: 16, marginTop: 24 }}>All Requests</h2>
          <Gallery
            items={allRequests}
            template={(req) => (
              <div>
                {DisplayLookup(inspectors, req.InspectorId)} — {req.Type} ({req.StartDate} — {req.EndDate})
                <div style={{ marginTop: 4 }}><StatusBadge status={req.Status} /></div>
              </div>
            )}
          />
        </section>
      </div>
    </div>
  );
}
