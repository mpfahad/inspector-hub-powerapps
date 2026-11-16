import { useEffect, useState } from 'react';
import { api, type Inspector, type Job } from '../../lib/api';
import { openAssignments, requiredTeamSize } from '../../lib/jobs';
import {
  emptyTeamSlots,
  filledTeamSlots,
  TeamSlotsEditor,
  type TeamSlot,
} from './TeamSlotsEditor';

type Props = {
  job: Job;
  open: boolean;
  onClose: () => void;
  onAssigned: () => void;
};

function ymd(iso?: string | null, fallback = '') {
  if (!iso) return fallback;
  return iso.slice(0, 10);
}

function slotsFromJob(job: Job): TeamSlot[] {
  const need = requiredTeamSize(job);
  const open = openAssignments(job);
  const defaults = { startDate: ymd(job.startDate), endDate: ymd(job.endDate) };
  const filled: TeamSlot[] = open.map((a) => ({
    key: `asg-${a.id}`,
    assignmentId: a.id,
    inspectorId: String(a.inspector.id),
    startDate: ymd(a.mobDate, defaults.startDate),
    endDate: ymd(a.demobDate, defaults.endDate),
    dayRate: a.dailyBillableUsd != null ? String(a.dailyBillableUsd) : '',
  }));
  const pad = Math.max(need, filled.length) - filled.length;
  return [...filled, ...emptyTeamSlots(pad, defaults).map((s, i) => ({ ...s, key: `empty-${i}-${Date.now()}` }))];
}

export function AssignInspectorModal({ job, open, onClose, onAssigned }: Props) {
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [slots, setSlots] = useState<TeamSlot[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  const team = openAssignments(job);
  const need = requiredTeamSize(job);

  useEffect(() => {
    if (!open) return;
    setError('');
    setSlots(slotsFromJob(job));
    setLoading(true);
    api
      .inspectors()
      .then((list) => setInspectors(list.filter((i) => i.status !== 'Inactive')))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load inspectors'))
      .finally(() => setLoading(false));
  }, [open, job.id, team.length, need, job.startDate, job.endDate]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const save = async () => {
    setError('');
    const filled = filledTeamSlots(slots);
    for (const s of filled) {
      if (!s.startDate || !s.endDate) {
        setError('Each selected inspector needs start and end dates.');
        return;
      }
      if (s.endDate < s.startDate) {
        setError('End date must be on or after start date.');
        return;
      }
    }

    const previous = openAssignments(job);
    const nextIds = new Set(filled.map((s) => Number(s.inspectorId)));
    const toRemove = previous.filter((a) => !nextIds.has(a.inspector.id));

    setBusy(true);
    try {
      for (const a of toRemove) {
        await api.removeJobAssignment(job.id, a.id);
      }
      for (let i = 0; i < filled.length; i++) {
        const s = filled[i];
        const dayRate = s.dayRate.trim() === '' ? null : Number(s.dayRate);
        await api.assignJob(job.id, Number(s.inspectorId), {
          role: i === 0 ? 'Lead' : 'Member',
          mobDate: s.startDate,
          demobDate: s.endDate,
          dayRateUsd: dayRate,
          allowOverfill: true,
        });
      }
      onAssigned();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save team');
    } finally {
      setBusy(false);
    }
  };

  const addSlot = () => {
    setSlots((prev) => [
      ...prev,
      ...emptyTeamSlots(1, {
        startDate: ymd(job.startDate),
        endDate: ymd(job.endDate),
      }),
    ]);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col shadow-xl"
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
                {job.ref} · {job.title} · target {need} PAX · leave rows blank if needed
              </p>
            </div>
            <button type="button" className="text-sm text-slate-500 hover:text-navy" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && <p className="text-sm text-red-600">{error}</p>}
          {loading ? (
            <p className="text-sm text-slate-500">Loading inspectors…</p>
          ) : (
            <>
              <TeamSlotsEditor
                slots={slots}
                inspectors={inspectors}
                onChange={setSlots}
                disabled={busy}
                rateBasis={job.rateBasis === 'hourly' ? 'hourly' : 'day'}
                hoursPerSlot={Math.max(
                  0,
                  Math.round((job.estimatedHours ?? 40) / Math.max(1, need))
                )}
              />
              <button type="button" className="btn-secondary text-sm" disabled={busy} onClick={addSlot}>
                Add another row
              </button>
            </>
          )}
        </div>

        <div className="p-4 border-t border-slate-100 flex flex-wrap gap-2 justify-end">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn-primary" disabled={busy || loading} onClick={save}>
            {busy ? 'Saving…' : 'Save team'}
          </button>
        </div>
      </div>
    </div>
  );
}
