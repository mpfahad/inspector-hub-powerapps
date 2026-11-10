import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api, type MapData } from '../lib/api';
import { JobsMapPanel } from '../components/jobs/JobsMapPanel';
import type { JobStageId } from '../lib/jobs';

function parseFilter(raw: string | null): JobStageId {
  if (raw === 'new' || raw === 'active' || raw === 'completed') return raw;
  return 'all';
}

export function MapPopoutPage() {
  const [params, setParams] = useSearchParams();
  const departmentId = useMemo(() => {
    const raw = params.get('departmentId');
    if (!raw) return undefined;
    const id = Number(raw);
    return Number.isFinite(id) ? id : undefined;
  }, [params]);
  const deptCode = params.get('deptCode') ?? undefined;

  const [filter, setFilter] = useState<JobStageId>(() => parseFilter(params.get('filter')));
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    document.title = 'Jobs map · IRPPMS';
  }, []);

  useEffect(() => {
    setError('');
    api
      .map(departmentId ? { departmentId } : undefined)
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load map'));
  }, [departmentId]);

  const onFilterChange = (next: JobStageId) => {
    setFilter(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'all') nextParams.delete('filter');
    else nextParams.set('filter', next);
    setParams(nextParams, { replace: true });
  };

  return (
    <div className="h-screen w-screen bg-slate-50 p-3 flex flex-col">
      <JobsMapPanel
        data={data}
        error={error}
        filter={filter}
        onFilterChange={onFilterChange}
        fillHeight
        showPopout={false}
        departmentId={departmentId}
        deptCode={deptCode}
        className="flex-1 min-h-0"
      />
    </div>
  );
}
