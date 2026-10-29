import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { api, type Assignment } from '../../lib/api';
import {
  ActiveAssignmentCard,
  CompletedAssignmentCard,
} from '../assignments/AssignmentActionCard';
import { TimesheetGenerator } from '../timesheets/TimesheetGenerator';

const RECENT_LIMIT = 5;

export function InspectorJobsView() {
  const location = useLocation();
  const [active, setActive] = useState<Assignment[]>([]);
  const [completed, setCompleted] = useState<Assignment[]>([]);
  const [showAllCompleted, setShowAllCompleted] = useState(false);

  const load = () =>
    api.myAssignments().then(({ active: a, completed: c }) => {
      setActive(a);
      setCompleted(c);
    });

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!location.hash) return;
    const id = location.hash.slice(1);
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, [location.hash, completed.length]);

  const visibleCompleted = showAllCompleted ? completed : completed.slice(0, RECENT_LIMIT);
  const hasMoreCompleted = completed.length > RECENT_LIMIT;

  return (
    <div className="max-w-3xl space-y-10">
      <section>
        <h2 className="text-lg font-semibold text-navy mb-4">Active jobs</h2>
        {active.length === 0 ? (
          <p className="text-slate-500 text-sm card p-5">No active jobs assigned to you.</p>
        ) : (
          <div className="space-y-4">
            {active.map((a) => (
              <ActiveAssignmentCard key={a.id} assignment={a} />
            ))}
          </div>
        )}
      </section>

      <section id="completed">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-navy">Completed jobs</h2>
          </div>
          {completed.length > 0 && (
            <span className="badge bg-slate-100 text-slate-700">{completed.length} total</span>
          )}
        </div>

        {completed.length === 0 ? (
          <p className="text-slate-500 text-sm card p-5">No completed jobs yet.</p>
        ) : (
          <>
            <div className="space-y-4">
              {visibleCompleted.map((a) => (
                <CompletedAssignmentCard key={a.id} assignment={a} />
              ))}
            </div>
            {hasMoreCompleted && !showAllCompleted && (
              <button
                type="button"
                className="btn-secondary mt-4"
                onClick={() => setShowAllCompleted(true)}
              >
                Show all {completed.length} completed
              </button>
            )}
          </>
        )}
      </section>

      <section>
        <h2 className="text-lg font-semibold text-navy mb-4">Timesheets</h2>
        <TimesheetGenerator />
      </section>
    </div>
  );
}
