import { useEffect, useState } from 'react';
import { api, type AuditEvent } from '../../lib/api';

type Props = {
  entityType?: string;
  entityId?: number;
  title?: string;
  limit?: number;
};

function formatAction(action: string) {
  return action.replace(/\./g, ' · ').replace(/_/g, ' ');
}

export function AuditTrail({ entityType, entityId, title = 'Audit trail', limit = 30 }: Props) {
  const [events, setEvents] = useState<AuditEvent[]>([]);

  useEffect(() => {
    api.auditEvents({ entityType, entityId, limit }).then(setEvents).catch(() => setEvents([]));
  }, [entityType, entityId, limit]);

  if (events.length === 0) {
    return (
      <div className="card p-6">
        <h2 className="font-semibold text-navy mb-2">{title}</h2>
        <p className="text-sm text-slate-500">No recorded actions yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-6">
      <h2 className="font-semibold text-navy mb-4">{title}</h2>
      <div className="space-y-2">
        {events.map((e) => (
          <div key={e.id} className="text-sm py-2 border-b border-slate-50 last:border-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-medium text-navy capitalize">{formatAction(e.action)}</span>
              <span className="text-slate-400">·</span>
              <span className="text-slate-500">{new Date(e.createdAt).toLocaleString()}</span>
              {e.user && (
                <>
                  <span className="text-slate-400">·</span>
                  <span className="text-slate-600">{e.user.fullName} ({e.user.role})</span>
                </>
              )}
            </div>
            {e.payload && (
              <pre className="text-xs text-slate-500 mt-1 whitespace-pre-wrap font-sans">
                {JSON.stringify(e.payload, null, 0).replace(/[{}"]/g, '').replace(/,/g, ', ')}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
