import type { TimesheetDetail, TimesheetPreview } from '../../lib/api';

type PreviewData = TimesheetPreview | (TimesheetDetail & { inspector: { name: string; employeeNo: string; department: { name: string } } });

function formatPreviewLines(data: PreviewData) {
  if ('lines' in data && data.lines.length > 0 && 'jobRef' in data.lines[0]) {
    return (data as TimesheetPreview).lines;
  }
  return (data as TimesheetDetail).lines.map((line) => {
    const desc = line.description ?? '';
    const jobRef = desc.split(':')[0]?.trim() || '—';
    const narrative = desc.includes(':') ? desc.slice(desc.indexOf(':') + 1).trim() : desc;
    return {
      logDate: line.logDate,
      jobRef,
      jobTitle: '',
      client: '',
      hours: line.hours,
      productiveHours: line.productiveHours,
      narrative,
    };
  });
}

export function TimesheetPreviewPanel({ data, onClose }: { data: PreviewData; onClose?: () => void }) {
  const deptName =
    typeof data.inspector.department === 'string'
      ? data.inspector.department
      : data.inspector.department.name;

  const lines = formatPreviewLines(data);
  const periodStart = data.periodStart.slice(0, 10);
  const periodEnd = data.periodEnd.slice(0, 10);

  return (
    <div className="card p-5 mt-4 border-teal/20 bg-slate-50/50">
      <div className="flex items-start justify-between gap-4 mb-4">
        <div>
          <h3 className="font-semibold text-navy">Timesheet preview</h3>
          <p className="text-sm text-slate-500 mt-1">
            {data.inspector.name} ({data.inspector.employeeNo}) · {deptName}
          </p>
          <p className="text-xs text-slate-400">{periodStart} — {periodEnd}</p>
        </div>
        {onClose && (
          <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={onClose}>
            Close
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <p className="text-sm text-slate-500">No activity logged in this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3">Date</th>
                <th className="pb-2 pr-3">Job</th>
                <th className="pb-2 pr-3">Client</th>
                <th className="pb-2 pr-3 text-right">Hours</th>
                <th className="pb-2 text-right">Productive</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line, i) => (
                <tr key={i} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 whitespace-nowrap">{line.logDate.slice(0, 10)}</td>
                  <td className="py-2 pr-3">
                    <div className="font-medium text-navy">{line.jobRef}</div>
                    {line.jobTitle && <div className="text-xs text-slate-500">{line.jobTitle}</div>}
                    {line.narrative && <div className="text-xs text-slate-400">{line.narrative}</div>}
                  </td>
                  <td className="py-2 pr-3 text-slate-600">{line.client || '—'}</td>
                  <td className="py-2 pr-3 text-right">{line.hours}h</td>
                  <td className="py-2 text-right">{line.productiveHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="flex gap-6 mt-4 pt-4 border-t border-slate-200 text-sm font-medium text-navy">
        <span>Total: {data.totalHours}h</span>
        <span>Productive: {data.totalProductiveHours}h</span>
      </div>
    </div>
  );
}
