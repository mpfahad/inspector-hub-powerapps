import type { JobCertSummary } from '../../lib/certs';
import { certMatchClass, certMatchLabel } from '../../lib/certs';

export function JobCertBadges({
  summary,
  compact,
}: {
  summary?: JobCertSummary | null;
  compact?: boolean;
}) {
  if (!summary || summary.items.length === 0) {
    return compact ? null : <p className="text-sm text-slate-400">No certification requirements.</p>;
  }

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-2' : ''}`}>
      {summary.items.map((item) => (
        <span
          key={item.certificationId}
          className={`badge ${certMatchClass(item.match)}`}
          title={`${item.code} — ${item.name} · ${item.mandatory ? 'Mandatory' : 'Optional'} · ${certMatchLabel(item.match)}`}
        >
          {item.code}
          {!compact && <span className="font-normal ml-1 opacity-80">· {certMatchLabel(item.match)}</span>}
          {compact && item.match !== 'unassigned' && item.match !== 'holds' ? (
            <span className="ml-1">{item.match === 'expiring' ? '!' : '×'}</span>
          ) : null}
        </span>
      ))}
    </div>
  );
}
