import { useState } from 'react';
import type { JobDetail } from '../../lib/api';
import { currentAssignment } from '../../lib/jobs';
import { AssignInspectorModal } from './AssignInspectorModal';

/** Thin wrapper kept for any legacy call sites — prefer AssignInspectorModal directly. */
export function AssignInspectorPanel({ job, onAssigned }: { job: JobDetail; onAssigned: () => void }) {
  const [open, setOpen] = useState(false);
  const openAssignment = currentAssignment(job);
  const show =
    (!openAssignment && ['Draft', 'Proposed'].includes(job.status)) ||
    (!!openAssignment && ['Proposed', 'PendingAcceptance', 'Active'].includes(job.status));

  if (!show) return null;

  return (
    <>
      <button type="button" className="btn-primary" onClick={() => setOpen(true)}>
        {openAssignment ? 'Reassign inspector' : 'Assign inspector'}
      </button>
      <AssignInspectorModal
        job={job}
        open={open}
        onClose={() => setOpen(false)}
        onAssigned={() => {
          setOpen(false);
          onAssigned();
        }}
      />
    </>
  );
}
