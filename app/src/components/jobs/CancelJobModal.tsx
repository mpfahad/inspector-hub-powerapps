import { useState } from 'react';
import { api, type Job } from '../../lib/api';

type Props = {
  job: Job;
  open: boolean;
  onClose: () => void;
  onCancelled: () => void;
};

export function CancelJobModal({ job, open, onClose, onCancelled }: Props) {
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (!open) return null;

  const trimmed = note.trim();
  const noteOk = trimmed.length >= 5;

  const submit = async () => {
    if (!noteOk) {
      setError('Enter a reason of at least 5 characters.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.cancelJob(job.id, trimmed);
      setNote('');
      onCancelled();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cancel failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="card w-full max-w-md shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="cancel-job-title"
      >
        <div>
          <h2 id="cancel-job-title" className="text-lg font-semibold text-navy">
            Cancel job
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {job.ref} — {job.title}. The job will leave the board and map; open assignments are cancelled.
          </p>
        </div>
        <div>
          <label className="text-xs font-medium" htmlFor="cancel-note">
            Reason / note <span className="text-slate-400">(required)</span>
          </label>
          <textarea
            id="cancel-note"
            className="input mt-1"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Duplicate of J-2026-387 created by mistake"
            disabled={busy}
          />
          <p className="text-xs text-slate-400 mt-1">Minimum 5 characters. Stored in status history.</p>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" className="btn-secondary" disabled={busy} onClick={onClose}>
            Keep job
          </button>
          <button
            type="button"
            className="btn-primary bg-red-700 hover:bg-red-800 border-red-700"
            disabled={busy || !noteOk}
            onClick={submit}
          >
            {busy ? 'Cancelling…' : 'Cancel job'}
          </button>
        </div>
      </div>
    </div>
  );
}
