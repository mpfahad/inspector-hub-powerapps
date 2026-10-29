import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, type Client, type Inspector, type InspectorCert } from '../lib/api';
import { formatMoney } from '../lib/money';
import { useAuth } from '../context/AuthContext';

function certBadgeClass(status: string) {
  if (status === 'Valid') return 'bg-teal/10 text-teal';
  if (status === 'ExpiringSoon') return 'bg-amber-100 text-amber-800';
  if (status === 'Expired') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function QualificationBadges({ certs }: { certs: InspectorCert[] }) {
  if (certs.length === 0) {
    return <span className="text-xs text-slate-400">None on file</span>;
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {certs.map((c) => (
        <span
          key={c.id}
          className={`badge ${certBadgeClass(c.status)}`}
          title={`${c.certification.name} · expires ${c.expiresOn.slice(0, 10)}`}
        >
          {c.certification.code}
        </span>
      ))}
    </div>
  );
}

export function InspectorsPage() {
  const { user } = useAuth();
  const isAdminUser = user?.role === 'Admin';
  const [items, setItems] = useState<Inspector[]>([]);
  useEffect(() => { api.inspectors().then(setItems); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-6">Inspectors</h1>
      <div className="card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
            <tr>
              <th className="p-3">Name</th>
              <th className="p-3">Employee</th>
              <th className="p-3">Department</th>
              {isAdminUser && (
                <>
                  <th className="p-3">CTC / day</th>
                  <th className="p-3">Billable / day</th>
                </>
              )}
              <th className="p-3">QE approved</th>
              <th className="p-3">Qualifications</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="border-t border-slate-100 align-top">
                <td className="p-3 font-medium">
                  <Link to={`/inspectors/${i.id}`} className="text-navy hover:text-teal">{i.name}</Link>
                </td>
                <td className="p-3">{i.employeeNo}</td>
                <td className="p-3">{i.department.name}</td>
                {isAdminUser && (
                  <>
                    <td className="p-3">{formatMoney(i.dailyCostUsd)}</td>
                    <td className="p-3">{formatMoney(i.dailyBillableUsd)}</td>
                  </>
                )}
                <td className="p-3">
                  {i.qeApproved ? (
                    <span className="badge bg-teal/10 text-teal">Yes</span>
                  ) : (
                    <span className="badge bg-slate-100 text-slate-500">No</span>
                  )}
                </td>
                <td className="p-3 max-w-md">
                  <QualificationBadges certs={i.inspectorCerts ?? []} />
                </td>
                <td className="p-3"><span className="badge bg-slate-100">{i.status}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Hover a qualification for full name and expiry. Green = valid, amber = expiring soon, red = expired.
        {isAdminUser ? ' Daily CTC/billable are Admin-only.' : ''}
      </p>
    </div>
  );
}

export function ClientsPage() {
  const [items, setItems] = useState<Client[]>([]);
  useEffect(() => { api.clients().then(setItems); }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold text-navy mb-6">Clients</h1>
      <div className="grid gap-4 md:grid-cols-2">
        {items.map((c) => (
          <div key={c.id} className="card p-5">
            <div className="font-semibold text-navy">{c.name}</div>
            <div className="text-sm text-slate-500">{c.industry} · {c.location}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
