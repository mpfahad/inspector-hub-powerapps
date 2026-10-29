import { useEffect, useMemo, useState } from 'react';
import { api, type Job, type MapData } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { InspectorJobsView } from '../components/jobs/InspectorJobsView';
import { JobBoardCard, JobListRow } from '../components/jobs/JobBoardCard';
import { JobsMapPanel } from '../components/jobs/JobsMapPanel';
import { JOB_STAGES, type JobStageId, matchesSearch, stageForJob } from '../lib/jobs';
import { TimesheetGenerator } from '../components/timesheets/TimesheetGenerator';

type ViewMode = 'board' | 'list';

function StatChip({
  label,
  count,
  active,
  chipClass,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  chipClass: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-4 py-3 text-left transition-all min-w-[130px] ${
        active ? 'border-teal bg-teal/5 shadow-sm ring-1 ring-teal/20' : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="text-2xl font-bold text-navy">{count}</div>
      <div className="text-xs text-slate-500 mt-0.5">{label}</div>
      {active && <div className={`badge mt-2 text-[10px] ${chipClass}`}>Filtered</div>}
    </button>
  );
}

function BoardColumn({
  stage,
  jobs,
}: {
  stage: (typeof JOB_STAGES)[number];
  jobs: Job[];
}) {
  return (
    <div className="min-w-[280px] w-[280px] shrink-0 flex flex-col max-h-[calc(100vh-280px)]">
      <div className={`rounded-t-xl border-t-4 ${stage.accent} bg-white border border-slate-200 border-t-4 px-4 py-3`}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-navy text-sm">{stage.label}</h3>
          <span className={`badge ${stage.chip}`}>{jobs.length}</span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1">{stage.description}</p>
      </div>
      <div className="flex-1 overflow-y-auto rounded-b-xl border border-t-0 border-slate-200 bg-slate-50/80 p-3 space-y-3">
        {jobs.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-8">No jobs</p>
        ) : (
          jobs.map((j) => <JobBoardCard key={j.id} job={j} />)
        )}
      </div>
    </div>
  );
}

export function JobsPage() {
  const { user } = useAuth();
  if (user?.role === 'Inspector') return <InspectorJobsView />;
  return <StaffJobsBoard />;
}

function StaffJobsBoard() {
  const [data, setData] = useState<Awaited<ReturnType<typeof api.jobsBoard>> | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [error, setError] = useState('');
  const [mapError, setMapError] = useState('');
  const [filter, setFilter] = useState<JobStageId>('all');
  const [view, setView] = useState<ViewMode>('board');
  const [search, setSearch] = useState('');

  const load = () => {
    api
      .jobsBoard()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load jobs'));
    api
      .map()
      .then(setMapData)
      .catch((err) => setMapError(err instanceof Error ? err.message : 'Could not load map'));
  };

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (window.location.hash === '#map') {
      requestAnimationFrame(() => {
        document.getElementById('map')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [data]);

  const allJobs = useMemo(() => {
    if (!data) return [];
    return [
      ...data.columns.new,
      ...data.columns.active,
      ...data.columns.completed,
    ].filter((job, i, arr) => arr.findIndex((j) => j.id === job.id) === i);
  }, [data]);

  const filteredJobs = useMemo(() => {
    let jobs = allJobs;
    if (filter !== 'all') {
      jobs = jobs.filter((j) => stageForJob(j) === filter);
    }
    if (search.trim()) jobs = jobs.filter((j) => matchesSearch(j, search));
    return jobs.sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [allJobs, filter, search]);

  const jobsByColumn = useMemo(() => {
    const map = Object.fromEntries(JOB_STAGES.map((s) => [s.id, [] as Job[]])) as Record<
      (typeof JOB_STAGES)[number]['id'],
      Job[]
    >;
    for (const job of filteredJobs) {
      const stageId = stageForJob(job);
      map[stageId].push(job);
    }
    return map;
  }, [filteredJobs]);

  if (error) {
    return (
      <div className="card p-6 text-red-600">
        {error}
        <button type="button" className="btn-secondary mt-4" onClick={load}>Retry</button>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-4">
        <div className="h-20 rounded-xl bg-slate-100 animate-pulse" />
        <div className="h-[360px] rounded-xl bg-slate-100 animate-pulse" />
        <div className="flex gap-4">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-96 w-[280px] rounded-xl bg-slate-100 animate-pulse shrink-0" />
          ))}
        </div>
      </div>
    );
  }

  const counts = data.counts;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <StatChip
          label="All jobs"
          count={counts.total}
          active={filter === 'all'}
          chipClass="bg-slate-100"
          onClick={() => setFilter('all')}
        />
        {JOB_STAGES.map((stage) => (
          <StatChip
            key={stage.id}
            label={stage.label}
            count={
              (counts[stage.id as keyof typeof counts] as number | undefined) ?? 0
            }
            active={filter === stage.id}
            chipClass={stage.chip}
            onClick={() => setFilter(stage.id)}
          />
        ))}
      </div>

      <JobsMapPanel
        data={mapData}
        error={mapError}
        filter={filter}
        onFilterChange={setFilter}
      />

      <div className="card p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <input
          type="search"
          className="input max-w-md"
          placeholder="Search ref, title, client, inspector…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex gap-2 shrink-0">
          <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md ${view === 'board' ? 'bg-white shadow-sm font-medium text-navy' : 'text-slate-500'}`}
              onClick={() => setView('board')}
            >
              Board
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-sm rounded-md ${view === 'list' ? 'bg-white shadow-sm font-medium text-navy' : 'text-slate-500'}`}
              onClick={() => setView('list')}
            >
              List
            </button>
          </div>
        </div>
      </div>

      {view === 'board' ? (
        <div className="flex gap-4 overflow-x-auto pb-4 -mx-1 px-1">
          {JOB_STAGES.map((stage) => (
            <BoardColumn
              key={stage.id}
              stage={stage}
              jobs={filter === 'all' || filter === stage.id ? jobsByColumn[stage.id] : []}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden md:grid grid-cols-[minmax(100px,1fr)_2fr_1fr_1fr_1fr_auto] gap-4 px-4 py-3 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-200">
            <span>Ref</span>
            <span>Job</span>
            <span>Type</span>
            <span>Inspector</span>
            <span>Dates</span>
            <span>Status</span>
          </div>
          {filteredJobs.length === 0 ? (
            <p className="text-sm text-slate-500 p-8 text-center">No jobs match your filters.</p>
          ) : (
            filteredJobs.map((j) => <JobListRow key={j.id} job={j} />)
          )}
        </div>
      )}

      <section id="timesheet" className="pt-2 border-t border-slate-200">
        <TimesheetGenerator compact showHistory />
      </section>
    </div>
  );
}
