import { useEffect, useMemo, useState } from 'react';
import { api, type AssignCandidate, type Assignment, type Job } from '../../lib/api';
import { openAssignments, requiredTeamSize } from '../../lib/jobs';
import { CURRENCY_CODE } from '../../lib/money';

type Props = {
  job: Job;
  open: boolean;
  onClose: () => void;
  /** Called after add/remove so parent can reload; modal stays open for more team edits. */
  onAssigned: () => void;
};

function bandStyles(band: AssignCandidate['band']) {
  if (band === 'ready') {
    return {
      row: 'border-l-4 border-l-emerald-500 bg-emerald-50/40',
      badge: 'bg-emerald-100 text-emerald-800',
      label: 'Ready',
      text: 'text-navy',
    };
  }
  if (band === 'caution') {
    return {
      row: 'border-l-4 border-l-amber-400 bg-amber-50/50',
      badge: 'bg-amber-100 text-amber-900',
      label: 'Caution',
      text: 'text-amber-950',
    };
  }
  return {
    row: 'border-l-4 border-l-slate-300 bg-slate-50',
    badge: 'bg-slate-200 text-slate-600',
    label: 'Busy',
    text: 'text-slate-500',
  };
}

export function AssignInspectorModal({ job, open, onClose, onAssigned }: Props) {
  const [candidates, setCandidates] = useState<AssignCandidate[]>([]);
  const [loading, setLoading] = useState(false);
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

  const team = openAssignments(job);
  const need = requiredTeamSize(job);
  const teamFull = team.length >= need;
  const onTeamIds = useMemo(() => new Set(team.map((a) => a.inspector.id)), [team]);
  const requiresQe = Boolean(job.requiresQeApproval);
  const parsedPrice = price.trim() === '' ? undefined : Number(price);

  const selected = useMemo(
    () => candidates.find((c) => String(c.id) === manualId) ?? null,
    [candidates, manualId]
  );

  const filtered = useMemo(() => {
    const q = manualSearch.trim().toLowerCase();
    if (!q) return candidates;
    return candidates.filter((c) =>
      [c.name, c.employeeNo, c.department.name, c.jobTitle ?? ''].join(' ').toLowerCase().includes(q)
    );
  }, [candidates, manualSearch]);

  useEffect(() => {
    if (!open) return;
    setError('');
    setManualId('');
    setManualSearch('');
    setPrice(
      job.agreedPriceUsd != null
        ? String(job.agreedPriceUsd)
        : job.suggestedPriceUsd != null
          ? String(job.suggestedPriceUsd)
          : ''
    );
    setLoading(true);
    api
      .assignCandidates(job.id)
      .then((r) => setCandidates(r.items))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load inspectors'))
      .finally(() => setLoading(false));
  }, [open, job.id, job.agreedPriceUsd, job.suggestedPriceUsd, team.length]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const confirmBusy = (c: AssignCandidate) => {
    if (!c.busy && c.certsOk) return true;
    const why = c.reasons.join('; ') || 'availability concerns';
    return window.confirm(`${c.name} may not be ideal (${why}). Assign anyway?`);
  };

  const confirmQe = (c: AssignCandidate) => {
    if (!requiresQe || c.qeOk) return true;
    return window.confirm(`${c.name} is not QE-approved. This job prefers QE. Assign anyway?`);
  };

  const confirmOverfill = () => {
    if (!teamFull) return true;
    return window.confirm(
      `Team already has ${team.length}/${need} inspectors. Add another anyway?`
    );
  };

  const removeMember = async (a: Assignment) => {
    if (!window.confirm(`Remove ${a.inspector.name} from this team?`)) return;
    setError('');
    setBusy(true);
    try {
      await api.removeJobAssignment(job.id, a.id);
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not remove inspector');
    } finally {
      setBusy(false);
    }
  };

  const assign = async () => {
    if (!selected) return;
    if (onTeamIds.has(selected.id)) {
      setError(`${selected.name} is already on this team.`);
      return;
    }
    if (!confirmOverfill()) return;
    if (!confirmQe(selected)) return;
    if (!confirmBusy(selected)) return;
    setError('');
    setBusy(true);
    try {
      await api.assignJob(job.id, selected.id, {
        agreedPriceUsd: Number.isFinite(parsedPrice) ? parsedPrice : undefined,
        allowOverfill: teamFull,
      });
      setManualId('');
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assignment failed');
    } finally {
      setBusy(false);
    }
  };

  const ctaLabel = () => {
    if (busy) return 'Saving…';
    if (selected && requiresQe && !selected.qeOk) {
      return teamFull ? 'Add anyway (QE override)' : 'Add to team anyway';
    }
    if (selected?.crossDept) return teamFull ? 'Add loan anyway' : 'Add to team (loan)';
    if (teamFull) return 'Add anyway';
    return team.length === 0 ? 'Assign to team' : 'Add to team';
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-lg max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="assign-modal-title"
      >
        <div className="p-5 border-b border-slate-100">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 id="assign-modal-title" className="text-lg font-semibold text-navy">
                Manage team
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                {job.ref} · {job.title} · {team.length}/{need} assigned
              </p>
            </div>
            <button type="button" className="text-sm text-slate-500 hover:text-navy" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {team.length > 0 && (
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {team.map((a) => (
                <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm">
                  <div className="min-w-0">
                    <div className="font-medium text-navy truncate">
                      {a.inspector.name}{' '}
                      <span className="text-slate-400 font-normal">({a.role})</span>
                    </div>
                    <div className="text-xs text-slate-500">{a.inspector.employeeNo}</div>
                  </div>
                  <button
                    type="button"
                    className="btn-secondary text-xs px-2 py-1 text-red-700 shrink-0"
                    disabled={busy}
                    onClick={() => removeMember(a)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

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
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <input
            type="search"
            className="input"
            placeholder="Search name, employee no, title, department…"
            value={manualSearch}
            onChange={(e) => setManualSearch(e.target.value)}
            autoFocus
          />

          <div className="flex flex-wrap gap-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-emerald-500" /> Ready
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Caution
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-slate-400" /> Busy
            </span>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
            {loading ? (
              <p className="p-4 text-sm text-slate-500">Loading inspectors…</p>
            ) : filtered.length === 0 ? (
              <p className="p-4 text-sm text-slate-500">No inspectors match.</p>
            ) : (
              filtered.map((c) => {
                const styles = bandStyles(c.band);
                const selectedRow = String(c.id) === manualId;
                const isCurrent = onTeamIds.has(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    disabled={busy || isCurrent}
                    onClick={() => setManualId(String(c.id))}
                    className={`w-full text-left px-3 py-2.5 text-sm transition-colors ${styles.row} ${
                      selectedRow ? 'ring-inset ring-2 ring-teal/40' : ''
                    } ${isCurrent ? 'opacity-60 cursor-default' : 'hover:brightness-[0.98]'} ${styles.text}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">
                        {c.name}{' '}
                        <span className="text-slate-400 font-normal">({c.employeeNo})</span>
                      </span>
                      <span className="shrink-0 flex items-center gap-1.5">
                        {isCurrent && <span className="badge bg-teal/10 text-teal text-[10px]">On team</span>}
                        <span className={`badge text-[10px] ${styles.badge}`}>{styles.label}</span>
                      </span>
                    </div>
                    <div className="text-xs mt-0.5 opacity-80">
                      {c.department.name}
                      {c.jobTitle ? ` · ${c.jobTitle}` : ''}
                    </div>
                    {c.reasons.length > 0 && (
                      <div className="text-[11px] mt-1 opacity-70">{c.reasons.slice(0, 3).join(' · ')}</div>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {selected?.crossDept && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <p className="text-sm font-medium text-amber-950">Assigning from another department</p>
              <p className="text-xs text-amber-800 mt-1">
                {selected.name} is in <strong>{selected.department.name}</strong>; this job is{' '}
                <strong>{job.department.name}</strong>.
              </p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
            Done
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={busy || !manualId || onTeamIds.has(Number(manualId))}
            onClick={assign}
          >
            {ctaLabel()}
          </button>
        </div>
      </div>
    </div>
  );
}
