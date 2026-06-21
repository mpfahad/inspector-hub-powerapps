import { useMemo } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnPrimary, Gallery, StatusBadge, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList, patchExisting } from '../powerplatform/connector';
import { DEMO_JOB, rankCandidates } from '../powerplatform/competency';
import { DisplayLookup } from '../powerplatform/operations';

export function ScrAssignments() {
  const { updateContext } = useAppContext();
  const assignments = getList('Assignments');
  const jobs = getList('Jobs');
  const inspectors = getList('Inspectors');

  const ranked = useMemo(() => rankCandidates(DEMO_JOB), []);
  const pending = useMemo(() => assignments.filter((a) => a.Status === 'Proposed'), [assignments]);

  const acceptAssignment = (id: number) => {
    const a = assignments.find((x) => x.ID === id);
    if (a) {
      patchExisting('Assignments', a, { Status: 'Confirmed', DecidedAt: new Date().toISOString() });
      updateContext({ varStatusMessage: 'Assignment accepted — Power Automate would notify coordinator' });
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Skill-Based Assignments" />
      <div style={{ padding: theme.spacing.lg, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: theme.spacing.lg }}>
        <section>
          <h2 style={{ fontSize: 16 }}>Ranked candidates — {DEMO_JOB.title}</h2>
          <p style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 }}>
            PowerFx: ForAll(Inspectors, Patch(colRanked, ...)) — ported from Lovable competency engine
          </p>
          <Gallery
            items={ranked.map((r, i) => ({ ...r, ID: i + 1 }))}
            template={(row) => {
              const r = row as typeof ranked[0] & { ID: number };
              return (
                <div style={{ opacity: r.blocked ? 0.6 : 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <strong>#{row.ID} {r.inspector.name}</strong>
                    <span style={{ fontWeight: 700, color: r.blocked ? theme.colors.danger : theme.colors.primary }}>{r.score}/100</span>
                  </div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{r.inspector.dept} · {r.inspector.location}</div>
                  {r.blocked && <div style={{ fontSize: 11, color: theme.colors.danger, marginTop: 4 }}>Blocked: {r.blockReasons.join('; ')}</div>}
                  {!r.blocked && (
                    <div style={{ fontSize: 11, marginTop: 4, color: theme.colors.textSecondary }}>
                      Cert {r.breakdown.certifications} · Avail {r.breakdown.availability} · Load {r.breakdown.workload}
                    </div>
                  )}
                </div>
              );
            }}
          />
        </section>

        <section>
          <h2 style={{ fontSize: 16 }}>Pending acceptance</h2>
          <Gallery
            items={pending}
            template={(a) => (
              <div>
                <strong>{DisplayLookup(jobs, a.JobId)}</strong>
                <div style={{ fontSize: 12 }}>{DisplayLookup(inspectors, a.InspectorId)} · {a.Role}</div>
                <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'center' }}>
                  <StatusBadge status={a.Status} />
                  <BtnPrimary onClick={() => acceptAssignment(a.ID)}>Accept</BtnPrimary>
                </div>
              </div>
            )}
            emptyText="No pending assignments"
          />
        </section>
      </div>
    </div>
  );
}
