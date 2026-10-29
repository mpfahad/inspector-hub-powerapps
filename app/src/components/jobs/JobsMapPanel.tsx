import { useEffect, useMemo, useRef } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { MapData, MapJob, MapStage } from '../../lib/api';
import type { JobStageId } from '../../lib/jobs';

const QATAR_CENTER: [number, number] = [25.3, 51.5];
const QATAR_ZOOM = 8;

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

type Props = {
  data: MapData | null;
  error?: string;
  filter: JobStageId;
  onFilterChange: (filter: JobStageId) => void;
};

export function JobsMapPanel({ data, error, filter, onFilterChange }: Props) {
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
    // Leaflet needs a tick after layout
    requestAnimationFrame(() => map.invalidateSize());

    return () => {
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
        radius: 11,
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

    // Slight offset so job dots sit near (not under) client markers when colocated
    const offsetByClient = new Map<number, number>();
    for (const job of visibleJobs) {
      const n = offsetByClient.get(job.clientId) ?? 0;
      offsetByClient.set(job.clientId, n + 1);
      const angle = (n * 55 * Math.PI) / 180;
      const lat = job.latitude + Math.cos(angle) * 0.012;
      const lng = job.longitude + Math.sin(angle) * 0.012;
      const style = STAGE_STYLE[job.stage];
      points.push([lat, lng]);
      L.circleMarker([lat, lng], {
        radius: 6,
        color: '#fff',
        fillColor: style.color,
        fillOpacity: 1,
        weight: 2,
      })
        .bindPopup(
          `<strong><a href="/jobs/${job.id}">${escapeHtml(job.ref)}</a></strong> — ${escapeHtml(job.title)}<br/>` +
            `${escapeHtml(job.clientName)}<br/>` +
            `<span style="color:${style.color}">${style.label}</span> · ${escapeHtml(job.status)}`
        )
        .addTo(layer);
    }

    if (points.length > 1) {
      map.fitBounds(L.latLngBounds(points), { padding: [36, 36], maxZoom: 10 });
    } else if (points.length === 1) {
      map.setView(points[0], 9);
    } else {
      map.setView(QATAR_CENTER, QATAR_ZOOM);
    }
    requestAnimationFrame(() => map.invalidateSize());
  }, [data, visibleClients, visibleJobs, filter]);

  return (
    <section id="map" className="card overflow-hidden">
      <div className="p-4 border-b border-slate-100 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-navy">Jobs map</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Large dots = client sites (tagged by job mix). Small dots = individual jobs. Scroll to zoom.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(
            [
              { id: 'all' as const, label: 'All', count: summary.new + summary.active + summary.completed },
              { id: 'new' as const, label: 'New', count: summary.new },
              { id: 'active' as const, label: 'Active', count: summary.active },
              { id: 'completed' as const, label: 'Completed', count: summary.completed },
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
                className={`inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  active ? 'border-teal bg-teal/5 font-medium text-navy' : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                }`}
              >
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                  aria-hidden
                />
                {opt.label}
                <span className="text-xs text-slate-400">{opt.count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {error && <p className="px-4 py-2 text-sm text-red-600">{error}</p>}

      <div className="relative">
        <div
          ref={containerRef}
          className="h-[360px] md:h-[420px] w-full bg-slate-100"
        />
        {!data && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-50/80 text-sm text-slate-500">
            Loading map…
          </div>
        )}
      </div>

      <div className="px-4 py-3 border-t border-slate-100 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600">Size:</span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-3 w-3 rounded-full bg-slate-400" />
          Large = client site
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-slate-400 ring-2 ring-white" />
          Small = job
        </span>
        <span className="inline-flex items-center gap-1.5 font-medium text-slate-600 ml-2">Colour:</span>
        {(Object.keys(STAGE_STYLE) as MapStage[]).map((stage) => (
          <span key={stage} className="inline-flex items-center gap-1.5">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: STAGE_STYLE[stage].color }}
            />
            <span className={`badge ${STAGE_STYLE[stage].chip}`}>{STAGE_STYLE[stage].label}</span>
          </span>
        ))}
        <span className="ml-auto">
          Showing {visibleJobs.length} job{visibleJobs.length === 1 ? '' : 's'}
          {filter !== 'all' ? ` (${filter})` : ''} ·{' '}
          <Link to="/clients" className="text-teal hover:underline">
            Clients
          </Link>
        </span>
      </div>
    </section>
  );
}
