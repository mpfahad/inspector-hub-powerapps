import { useEffect, useMemo, useState } from 'react';
import { api, type Inspector, type JobDetail } from '../../lib/api';
import { currentAssignment } from '../../lib/jobs';
import { CURRENCY_CODE } from '../../lib/money';

type Props = {
  job: JobDetail;
  onAssigned: () => void;
};

export function AssignInspectorPanel({ job, onAssigned }: Props) {
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [manualId, setManualId] = useState('');
  const [manualSearch, setManualSearch] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [price, setPrice] = useState(
    job.agreedPriceUsd != null
      ? String(job.agreedPriceUsd)
      : job.suggestedPriceUsd != null
        ? String(job.suggestedPriceUsd)
        : ''
  );

  const openAssignment = currentAssignment(job);
  const isUnassigned = !openAssignment && ['Draft', 'Proposed'].includes(job.status);
  const canReassign = !!openAssignment && ['Proposed', 'PendingAcceptance', 'Active'].includes(job.status);
  const proposals = job.proposals.filter((p) => !p.blocked);
  const requiresQe = Boolean(job.requiresQeApproval);
  const parsedPrice = price.trim() === '' ? undefined : Number(price);

  const selected = useMemo(
    () => inspectors.find((i) => String(i.id) === manualId) ?? null,
    [inspectors, manualId]
  );
  const selectedNeedsQeWarning = Boolean(requiresQe && selected && !selected.qeApproved);

  const sortedInspectors = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    const rows = q
      ? inspectors.filter((i) =>
          [i.name, i.employeeNo, i.department.name, i.jobTitle ?? '']
            .join(' ')
            .toLowerCase()
            .includes(q)
        )
      : inspectors;
    return [...rows].sort((a, b) => {
      if (requiresQe) {
        if (a.qeApproved !== b.qeApproved) return a.qeApproved ? -1 : 1;
      }
      return a.name.localeCompare(b.name);
    });
  }, [inspectors, manualSearch, requiresQe]);

  useEffect(() => {
    api.inspectors().then(setInspectors);
  }, []);

  useEffect(() => {
    setPrice(
      job.agreedPriceUsd != null
        ? String(job.agreedPriceUsd)
        : job.suggestedPriceUsd != null
          ? String(job.suggestedPriceUsd)
          : ''
    );
  }, [job.agreedPriceUsd, job.suggestedPriceUsd]);

  const assign = async (inspectorId: number) => {
    setError('');
    setBusy(true);
    try {
      await api.assignJob(job.id, inspectorId, undefined, Number.isFinite(parsedPrice) ? parsedPrice : undefined);
      setManualId('');
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const runEngine = async () => {
    setError('');
    setBusy(true);
    try {
      if (job.status === 'Draft') {
        await api.submitJob(job.id);
      } else {
        await api.rerunJobAssessment(job.id);
      }
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Engine run failed');
    } finally {
      setBusy(false);
    }
  };

  if (!isUnassigned && !canReassign) return null;

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-navy">
          {isUnassigned ? 'Assign inspector' : 'Change assigned inspector'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {isUnassigned
            ? requiresQe
              ? 'This job prefers a QE-approved inspector. Non–QE staff are listed in grey — you can still assign them after confirming the warning. The job becomes Active immediately.'
              : 'No inspector is assigned yet. Use engine suggestions or pick any inspector manually. The job becomes Active immediately.'
            : `Currently assigned to ${openAssignment!.inspector.name}. Reassigning keeps the job Active with the new inspector.`}
        </p>
      </div>

      <div>
        <label className="text-xs text-slate-500">Agreed job price ({CURRENCY_CODE})</label>
        <input
          className="input mt-1 max-w-xs"
          type="number"
          min="0"
          step="1"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
        />
        <p className="text-xs text-slate-400 mt-1">Copied from the price chart default unless you change it at assign time.</p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {isUnassigned && job.status === 'Draft' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">This job is still a draft. Run the assignment engine to get inspector suggestions.</p>
          <button type="button" className="btn-secondary mt-3" disabled={busy} onClick={runEngine}>
            Submit & run assignment engine
          </button>
        </div>
      )}

      {proposals.length > 0 && (
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
            Engine suggestions
          </h3>
          <div className="space-y-2">
            {proposals.map((p) => {
              const isCurrent = openAssignment?.inspector.id === p.inspector.id;
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 bg-white p-3"
                >
                  <div>
                    <div className="font-medium text-navy">
                      #{p.rank} {p.inspector.name}
                      <span className="text-slate-400 font-normal ml-2">{p.inspector.employeeNo}</span>
                      {p.inspector.qeApproved && (
                        <span className="badge bg-teal/10 text-teal ml-2 text-[10px]">QE approved</span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      Score {p.score}/100
                      {p.warnings && ` · ${p.warnings}`}
                    </div>
                  </div>
                  {isCurrent ? (
                    <span className="badge bg-teal/10 text-teal">Current</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-primary text-xs shrink-0"
                      disabled={busy}
                      onClick={() => assign(p.inspector.id)}
                    >
                      {openAssignment ? 'Reassign' : 'Assign'}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
          {isUnassigned && job.status === 'Proposed' && (
            <button type="button" className="text-xs text-teal mt-3 hover:underline" disabled={busy} onClick={runEngine}>
              Re-run assignment engine
            </button>
          )}
        </div>
      )}

      {isUnassigned && proposals.length === 0 && job.status === 'Proposed' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm text-slate-600">No engine suggestions. Assign manually below or re-run the engine.</p>
          <button type="button" className="btn-secondary mt-3" disabled={busy} onClick={runEngine}>
            Re-run assignment engine
          </button>
        </div>
      )}

      <div className="border-t border-slate-100 pt-6 space-y-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Manual assignment
        </h3>
        <p className="text-sm text-slate-500">
          {requiresQe
            ? 'QE-approved staff appear first. Non–QE staff are shown in grey — selecting one shows a warning before you assign.'
            : 'Override the engine and assign any inspector.'}
        </p>
        <input
          type="search"
          className="input max-w-md"
          placeholder="Search inspectors…"
          value={manualSearch}
          onChange={(e) => setManualSearch(e.target.value)}
        />
        <div className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
          {sortedInspectors.length === 0 ? (
            <p className="p-3 text-sm text-slate-500">No inspectors match.</p>
          ) : (
            sortedInspectors.map((i) => {
              const muted = requiresQe && !i.qeApproved;
              const selectedRow = String(i.id) === manualId;
              const isCurrent = openAssignment?.inspector.id === i.id;
              return (
                <button
                  key={i.id}
                  type="button"
                  disabled={busy || isCurrent}
                  onClick={() => setManualId(String(i.id))}
                  className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${
                    selectedRow ? 'bg-teal/5 ring-inset ring-1 ring-teal/30' : 'hover:bg-slate-50'
                  } ${muted ? 'text-slate-400' : 'text-navy'} ${isCurrent ? 'opacity-60 cursor-default' : ''}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={muted ? 'font-normal' : 'font-medium'}>
                      {i.name}{' '}
                      <span className={muted ? 'text-slate-300' : 'text-slate-400'}>({i.employeeNo})</span>
                    </span>
                    <span className="shrink-0 flex items-center gap-1.5">
                      {isCurrent && <span className="badge bg-teal/10 text-teal text-[10px]">Current</span>}
                      {i.qeApproved ? (
                        <span className="badge bg-teal/10 text-teal text-[10px]">QE</span>
                      ) : requiresQe ? (
                        <span className="badge bg-slate-100 text-slate-400 text-[10px]">Not QE</span>
                      ) : null}
                    </span>
                  </div>
                  <div className={`text-xs mt-0.5 ${muted ? 'text-slate-300' : 'text-slate-500'}`}>
                    {i.department.name}
                    {i.jobTitle ? ` · ${i.jobTitle}` : ''}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {selectedNeedsQeWarning && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-sm font-medium text-amber-950">This job requires a QE-approved inspector</p>
            <p className="text-xs text-amber-800 mt-1">
              {selected!.name} is not marked QE-approved. You can still assign them — confirm that this override is intentional.
            </p>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !manualId || openAssignment?.inspector.id === Number(manualId)}
            onClick={() => assign(Number(manualId))}
          >
            {busy
              ? 'Assigning…'
              : selectedNeedsQeWarning
                ? 'Assign anyway (override QE)'
                : openAssignment
                  ? 'Reassign'
                  : 'Assign'}
          </button>
          {manualId && (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setManualId('')}>
              Clear selection
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
