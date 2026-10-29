import { useEffect, useState } from 'react';
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
  const blockedQe = job.requiresQeApproval
    ? job.proposals.filter((p) => p.blocked && (p.blockReasons ?? '').includes('Not QE-approved'))
    : [];
  const requiresQe = Boolean(job.requiresQeApproval);
  const parsedPrice = price.trim() === '' ? undefined : Number(price);

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

  const eligibleManual = requiresQe ? inspectors.filter((i) => i.qeApproved) : inspectors;
  const blockedManual = requiresQe ? inspectors.filter((i) => !i.qeApproved) : [];

  return (
    <div className="card p-6 space-y-6">
      <div>
        <h2 className="font-semibold text-navy">
          {isUnassigned ? 'Assign inspector' : 'Change assigned inspector'}
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          {isUnassigned
            ? requiresQe
              ? 'This job requires a QE-approved inspector. Only profile-flagged inspectors can be assigned; the job becomes Active immediately.'
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

      {blockedQe.length > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm font-medium text-amber-950">Blocked — not QE-approved</p>
          <p className="text-xs text-amber-800 mt-1 mb-2">
            Mark QE approved on the inspector profile before assigning to this job.
          </p>
          <ul className="text-sm text-amber-900 space-y-1">
            {blockedQe.slice(0, 5).map((p) => (
              <li key={p.id}>
                {p.inspector.name}{' '}
                <span className="text-amber-700">({p.inspector.employeeNo})</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isUnassigned && proposals.length === 0 && job.status === 'Proposed' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <p className="text-sm text-amber-900">No eligible inspectors matched. Re-run the engine or assign manually below.</p>
          <button type="button" className="btn-secondary mt-3" disabled={busy} onClick={runEngine}>
            Re-run assignment engine
          </button>
        </div>
      )}

      <div className="border-t border-slate-100 pt-6">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
          Manual assignment
        </h3>
        <p className="text-sm text-slate-500 mb-3">
          {requiresQe
            ? 'Only QE-approved inspectors are listed. Others are blocked until marked on their profile.'
            : 'Override the engine and assign any inspector.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <select
            className="input flex-1"
            value={manualId}
            onChange={(e) => setManualId(e.target.value)}
          >
            <option value="">Select inspector…</option>
            {eligibleManual.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.employeeNo}) — {i.department.name}
                {i.qeApproved ? ' · QE approved' : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-primary shrink-0"
            disabled={busy || !manualId}
            onClick={() => assign(Number(manualId))}
          >
            {openAssignment ? 'Reassign' : 'Assign'}
          </button>
        </div>
        {blockedManual.length > 0 && (
          <p className="text-xs text-slate-400 mt-2">
            {blockedManual.length} inspector{blockedManual.length === 1 ? '' : 's'} hidden (not QE-approved).
          </p>
        )}
      </div>
    </div>
  );
}
