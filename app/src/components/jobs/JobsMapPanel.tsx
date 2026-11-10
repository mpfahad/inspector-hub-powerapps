import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapData, MapJob, MapStage } from '../../lib/api';
import type { JobStageId } from '../../lib/jobs';

const QATAR_CENTER: [number, number] = [25.3, 51.5];
const QATAR_ZOOM = 8;
const POPOUT_NAME = 'irppms-jobs-map';

/** Map / stage colour standard: New = blue, Active = green (live), Completed = muted gray (stale). */
const STAGE_STYLE: Record<
  MapStage,
  { color: string; label: string; chip: string }
> = {
  new: { color: '#2563eb', label: 'New', chip: 'bg-blue-50 text-blue-700' },
  active: { color: '#059669', label: 'Active', chip: 'bg-emerald-50 text-emerald-800' },
  completed: { color: '#94a3b8', label: 'Completed', chip: 'bg-slate-100 text-slate-500' },
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function matchesFilter(stage: MapStage, filter: JobStageId) {
  return filter === 'all' || filter === stage;
}

function jobHref(jobId: number, deptCode?: string) {
  return deptCode ? `/d/${deptCode}/jobs/${jobId}` : `/jobs/${jobId}`;
}

export function openJobsMapPopout(opts: {
  filter: JobStageId;
  departmentId?: number;
  deptCode?: string;
}) {
  const q = new URLSearchParams();
  if (opts.filter && opts.filter !== 'all') q.set('filter', opts.filter);
  if (opts.departmentId) q.set('departmentId', String(opts.departmentId));
  if (opts.deptCode) q.set('deptCode', opts.deptCode);
  const qs = q.toString();
  const url = `/map/popout${qs ? `?${qs}` : ''}`;
  const features = 'width=960,height=720,menubar=no,toolbar=no,location=yes,status=no,resizable=yes,scrollbars=yes';
  const win = window.open(url, POPOUT_NAME, features);
  win?.focus();
  return win;
}

type Props = {
  data: MapData | null;
  error?: string;
  filter: JobStageId;
  onFilterChange: (filter: JobStageId) => void;
  /** Tighter chrome for the jobs-board sidebar. */
  compact?: boolean;
  /** Stretch map to fill parent height (sticky side panel / popout). */
  fillHeight?: boolean;
  /** Show Pop out control (hidden inside the popup itself). */
  showPopout?: boolean;
  departmentId?: number;
  deptCode?: string;
  className?: string;
};

export function JobsMapPanel({
  data,
  error,
  filter,
  onFilterChange,
  compact = false,
  fillHeight = false,
  showPopout = true,
  departmentId,
  deptCode,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const visibleJobs = useMemo(() => {
    if (!data) return [] as MapJob[];
    return data.jobs.filter((j) => matchesFilter(j.stage, filter));
  }, [data, filter]);

  const visibleClients = useMemo(() => {
    if (!data) return [];
    if (filter === 'all') return data.clients;
    return data.clients.filter((c) => c.counts[filter] > 0);
  }, [data, filter]);

  const summary = useMemo(() => {
    if (!data) return { new: 0, active: 0, completed: 0 };
    return {
      new: data.jobs.filter((j) => j.stage === 'new').length,
      active: data.jobs.filter((j) => j.stage === 'active').length,
      completed: data.jobs.filter((j) => j.stage === 'completed').length,
    };
  }, [data]);

  // Create map once
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(QATAR_CENTER, QATAR_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);
    requestAnimationFrame(() => map.invalidateSize());
    // Second pass after sticky/flex layout settles
    const t = window.setTimeout(() => map.invalidateSize(), 120);

    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', onResize);
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Redraw markers when data/filter changes
  useEffect(() => {
    const map = mapRef.current;
    const layer = layerRef.current;
    if (!map || !layer || !data) return;

    layer.clearLayers();
    const points: [number, number][] = [];

    for (const client of visibleClients) {
      if (client.latitude == null || client.longitude == null) continue;
      const primary =
        filter !== 'all' && client.counts[filter] > 0
          ? filter
          : client.primaryStage ?? 'new';
      const style = STAGE_STYLE[primary];
      const tagBits = [
        client.counts.active ? `<span style="color:#059669">${client.counts.active} active</span>` : null,
        client.counts.new ? `<span style="color:#2563eb">${client.counts.new} new</span>` : null,
        client.counts.completed ? `<span style="color:#94a3b8">${client.counts.completed} done</span>` : null,
      ]
        .filter(Boolean)
        .join(' · ');

      points.push([client.latitude, client.longitude]);
      L.circleMarker([client.latitude, client.longitude], {
        radius: compact ? 9 : 11,
        color: style.color,
        fillColor: style.color,
        fillOpacity: 0.9,
        weight: 2,
      })
        .bindPopup(
          `<strong>${escapeHtml(client.name)}</strong><br/>` +
            `${escapeHtml(client.location ?? '—')}<br/>` +
            `<strong style="color:${style.color}">${style.label}</strong> site tag<br/>` +
            (tagBits || 'No jobs')
        )
        .addTo(layer);
    }

    const offsetByClient = new Map<number, number>();
    for (const job of visibleJobs) {
      const n = offsetByClient.get(job.clientId) ?? 0;
      offsetByClient.set(job.clientId, n + 1);
      const angle = (n * 55 * Math.PI) / 180;
      const lat = job.latitude + Math.cos(angle) * 0.012;
      const lng = job.longitude + Math.sin(angle) * 0.012;
      const style = STAGE_STYLE[job.stage];
      const href = jobHref(job.id, deptCode);
      const inspectors = job.inspectors ?? [];
      const inspectorLine =
        inspectors.length === 0
          ? `<div style="margin-top:6px;font-size:11px;color:#94a3b8">Unassigned</div>`
          : `<div style="margin-top:6px;font-size:11px;color:#334155"><span style="color:#64748b">Inspector${
              inspectors.length === 1 ? '' : 's'
            }:</span> ${inspectors.map((i) => escapeHtml(i.name)).join(', ')}</div>`;
      points.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: compact ? 5 : 6,
        color: '#fff',
        fillColor: style.color,
        fillOpacity: 1,
        weight: 2,
      })
        .bindPopup(
          `<div style="min-width:180px;max-width:260px">` +
            `<div style="font-weight:600;color:#1e3a5f;font-size:13px">${escapeHtml(job.ref)}</div>` +
            `<div style="font-size:12px;margin-top:2px">${escapeHtml(job.title)}</div>` +
            `<div style="font-size:11px;color:#64748b;margin-top:4px">${escapeHtml(job.clientName)}</div>` +
            `<div style="margin-top:6px;font-size:11px"><span style="color:${style.color};font-weight:600">${style.label}</span></div>` +
            inspectorLine +
            `<div style="margin-top:10px">` +
            `<a href="${href}" style="display:inline-block;padding:4px 10px;border-radius:6px;background:#0d9488;color:#fff;font-size:11px;font-weight:600;text-decoration:none">Open job</a>` +
            `</div></div>`
        )
        .addTo(layer);
    }

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [compact ? 24 : 36, compact ? 24 : 36], maxZoom: 10 });
    } else if (points.length === 1) {
      map.setView(points[0], 9);
    } else {
      map.setView(QATAR_CENTER, QATAR_ZOOM);
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [data, visibleClients, visibleJobs, filter, compact, deptCode]);

  const mapHeightClass = fillHeight
    ? 'flex-1 min-h-[240px] h-full'
    : compact
      ? 'h-[280px]'
      : 'h-[360px] md:h-[420px]';

  return (
    <section
      id="map"
      className={`card overflow-hidden ${fillHeight ? 'h-full flex flex-col' : ''} ${className}`}
    >
      <div
        className={`border-b border-slate-100 flex flex-col gap-2 ${
          compact ? 'p-3' : 'p-4 lg:flex-row lg:items-center lg:justify-between gap-3'
        }`}
      >
        <div className="flex items-start justify-between gap-2 min-w-0">
          <div className="min-w-0">
            <h2 className={`font-semibold text-navy ${compact ? 'text-sm' : 'text-base'}`}>Jobs map</h2>
            {!compact && (
              <p className="text-xs text-slate-500 mt-0.5">
                Large dots = client sites. Small dots = jobs. Scroll to zoom.
              </p>
            )}
          </div>
          {showPopout && (
            <button
              type="button"
              className="btn-secondary text-xs shrink-0 px-2.5 py-1.5"
              title="Open map in a separate window"
              onClick={() => openJobsMapPopout({ filter, departmentId, deptCode })}
            >
              Pop out
            </button>
          )}
        </div>
        <div className={`flex flex-wrap gap-1.5 ${compact ? '' : 'gap-2'}`}>
          {(
            [
              { id: 'all' as const, label: 'All', count: summary.new + summary.active + summary.completed },
              { id: 'new' as const, label: 'New', count: summary.new },
              { id: 'active' as const, label: 'Active', count: summary.active },
              { id: 'completed' as const, label: 'Done', count: summary.completed },
            ] as const
          ).map((opt) => {
            const active = filter === opt.id;
            const color =
              opt.id === 'all' ? '#1e3a5f' : STAGE_STYLE[opt.id as MapStage].color;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onFilterChange(opt.id)}
                className={`inline-flex items-center gap-1.5 rounded-lg border transition-colors ${
                  compact ? 'px-2 py-1 text-xs' : 'px-3 py-1.5 text-sm gap-2'
                } ${
                  active ? 'border-teal bg-teal/5 font-medium text-navy' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                {opt.label}
                <span className="text-[10px] text-slate-400">{opt.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="px-3 py-2 text-sm text-red-600">{error}</p>}

      <div className={`relative ${fillHeight ? 'flex-1 min-h-0' : ''}`}>
        <div
          ref={containerRef}
          className={`${mapHeightClass} w-full bg-slate-100`}
        />
        {!data && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 text-sm text-slate-500">
            Loading map…
          </div>
        )}
      </div>

      <div
        className={`border-t border-slate-100 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 ${
          compact ? 'px-3 py-2' : 'px-4 py-3 gap-x-5 gap-y-2 text-xs'
        }`}
      >
        {(Object.keys(STAGE_STYLE) as MapStage[]).map((stage) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: STAGE_STYLE[stage].color }}
            />
            {STAGE_STYLE[stage].label}
          </span>
        ))}
        <span className="ml-auto truncate">
          {visibleJobs.length} job{visibleJobs.length === 1 ? '' : 's'}
          {!compact && (
            <>
              {' · '}
              <Link to="/clients" className="text-teal hover:underline">
                Clients
              </Link>
            </>
          )}
        </span>
      </div>
    </section>
  );
}
