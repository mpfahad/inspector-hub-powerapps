import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { api, type MapData } from '../lib/api';

/** Qatar-first default view (Leaflet / OSM). */
const QATAR_CENTER: [number, number] = [25.3, 51.5];
const QATAR_ZOOM = 8;

export function MapPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const [data, setData] = useState<MapData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api
      .map()
      .then(setData)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load map'));
  }, []);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    const points = [
      ...data.clients.map((c) => ({ lat: c.latitude!, lng: c.longitude! })),
      ...data.jobs.map((j) => ({ lat: j.latitude!, lng: j.longitude! })),
    ];
    const map = L.map(containerRef.current).setView(QATAR_CENTER, QATAR_ZOOM);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map);

    for (const client of data.clients) {
      if (client.latitude == null || client.longitude == null) continue;
      L.circleMarker([client.latitude, client.longitude], {
        radius: 9,
        color: '#1e3a5f',
        fillColor: '#1e3a5f',
        fillOpacity: 0.85,
        weight: 1,
      })
        .bindPopup(
          `<strong>${client.name}</strong><br/>${client.location ?? '—'}<br/>${client.openJobCount} open job${client.openJobCount === 1 ? '' : 's'}`
        )
        .addTo(map);
    }

    for (const job of data.jobs) {
      if (job.latitude == null || job.longitude == null) continue;
      L.circleMarker([job.latitude, job.longitude], {
        radius: 6,
        color: '#0d9488',
        fillColor: '#0d9488',
        fillOpacity: 0.9,
        weight: 1,
      })
        .bindPopup(
          `<strong>${job.ref}</strong> — ${job.title}<br/>${job.clientName}<br/>${job.location ?? ''}<br/>${job.status}`
        )
        .addTo(map);
    }

    if (points.length > 1) {
      map.fitBounds(
        L.latLngBounds(points.map((p) => [p.lat, p.lng] as [number, number])),
        { padding: [40, 40], maxZoom: 9 }
      );
    } else if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 9);
    }

    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [data]);

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-teal mb-1">Locations</p>
        <h1 className="text-2xl font-bold text-navy">Client & job map</h1>
        <p className="text-sm text-slate-500 mt-1">
          Qatar-first view with sample client coordinates (OpenStreetMap — no Google key). Navy = clients, teal = open jobs.
        </p>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div ref={containerRef} className="h-[70vh] min-h-[420px] rounded-xl border border-slate-200 overflow-hidden bg-slate-100" />
      {data && (
        <p className="text-xs text-slate-400">
          {data.clients.length} geocoded client{data.clients.length === 1 ? '' : 's'} · {data.jobs.length} open job
          {data.jobs.length === 1 ? '' : 's'} with coordinates
        </p>
      )}
    </div>
  );
}
