import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  api,
  type Certification,
  type InspectorDetail,
  type InspectorCert,
} from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { formatMoney } from '../lib/money';

function certBadgeClass(status: string) {
  if (status === 'Valid') return 'bg-teal/10 text-teal';
  if (status === 'ExpiringSoon') return 'bg-amber-100 text-amber-800';
  if (status === 'Expired') return 'bg-red-100 text-red-700';
  return 'bg-slate-100 text-slate-600';
}

function toDateOnly(value: string) {
  return value.slice(0, 10);
}

/** Job still open and past planned end (not about a single day's hours). */
function isJobCurrentlyOverdue(job: { endDate?: string; status?: string; completedAt?: string | null }) {
  if (!job.endDate) return false;
  if (job.completedAt) return false;
  if (job.status && !['Active', 'PendingAcceptance', 'Proposed'].includes(job.status)) return false;
  const today = toDateOnly(new Date().toISOString());
  return today > toDateOnly(job.endDate);
}

function statusLabel(status: string) {
  if (status === 'ExpiringSoon') return 'Expiring soon';
  return status;
}

export function InspectorDetailPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManageCerts = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const isAdminUser = user?.role === 'Admin';

  const [inspector, setInspector] = useState<InspectorDetail | null>(null);
  const [catalog, setCatalog] = useState<Certification[]>([]);
  const [certError, setCertError] = useState('');
  const [savingCert, setSavingCert] = useState(false);
  const [editingCertId, setEditingCertId] = useState<number | null>(null);
  const [costForm, setCostForm] = useState({ dailyCostUsd: '', dailyBillableUsd: '' });
  const [costError, setCostError] = useState('');
  const [savingCost, setSavingCost] = useState(false);
  const [qeBusy, setQeBusy] = useState(false);
  const [qeError, setQeError] = useState('');
  const [form, setForm] = useState({
    certificationId: '',
    issuedOn: '',
    expiresOn: '',
  });

  const load = () =>
    api.inspector(Number(id)).then((row) => {
      setInspector(row);
      setCostForm({
        dailyCostUsd: row.dailyCostUsd != null ? String(row.dailyCostUsd) : '',
        dailyBillableUsd: row.dailyBillableUsd != null ? String(row.dailyBillableUsd) : '',
      });
    }).catch(() => setInspector(null));

  useEffect(() => {
    load();
  }, [id]);

  useEffect(() => {
    if (!canManageCerts) return;
    api.certifications().then(setCatalog).catch(console.error);
  }, [canManageCerts]);

  if (!inspector) return <p>Loading inspector…</p>;

  const active = inspector.assignments.filter((a) =>
    ['PendingAcceptance', 'Accepted', 'Active'].includes(a.status)
  );

  const heldCertIds = new Set((inspector.inspectorCerts ?? []).map((c) => c.certification.id));
  const addOptions = catalog.filter((c) => !heldCertIds.has(c.id));

  const resetForm = () => {
    setEditingCertId(null);
    setForm({ certificationId: '', issuedOn: '', expiresOn: '' });
    setCertError('');
  };

  const startEdit = (cert: InspectorCert) => {
    setEditingCertId(cert.id);
    setForm({
      certificationId: String(cert.certification.id),
      issuedOn: cert.issuedOn.slice(0, 10),
      expiresOn: cert.expiresOn.slice(0, 10),
    });
    setCertError('');
  };

  const saveCert = async () => {
    setCertError('');
    if (!form.issuedOn || !form.expiresOn) {
      setCertError('Issued and expiry dates are required.');
      return;
    }
    if (!editingCertId && !form.certificationId) {
      setCertError('Select a certification to add.');
      return;
    }

    setSavingCert(true);
    try {
      if (editingCertId) {
        await api.updateInspectorCert(inspector.id, editingCertId, {
          certificationId: Number(form.certificationId),
          issuedOn: form.issuedOn,
          expiresOn: form.expiresOn,
        });
      } else {
        await api.addInspectorCert(inspector.id, {
          certificationId: Number(form.certificationId),
          issuedOn: form.issuedOn,
          expiresOn: form.expiresOn,
        });
      }
      resetForm();
      await load();
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Could not save certification');
    } finally {
      setSavingCert(false);
    }
  };

  const removeCert = async (certId: number) => {
    if (!window.confirm('Remove this certification from the inspector?')) return;
    setCertError('');
    setSavingCert(true);
    try {
      await api.deleteInspectorCert(inspector.id, certId);
      if (editingCertId === certId) resetForm();
      await load();
    } catch (err) {
      setCertError(err instanceof Error ? err.message : 'Could not remove certification');
    } finally {
      setSavingCert(false);
    }
  };

  return (
    <div className="max-w-4xl space-y-6">
      <Link to="/inspectors" className="text-sm text-teal">← Inspectors</Link>

      <div className="card p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-navy">{inspector.name}</h1>
            <p className="text-sm text-slate-500 mt-1">
              {inspector.employeeNo} · {inspector.department.name}
              {inspector.jobTitle ? ` · ${inspector.jobTitle}` : ''}
              {inspector.baseLocation ? ` · ${inspector.baseLocation}` : ''}
              {inspector.highestQualification ? ` · ${inspector.highestQualification}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {inspector.qeApproved && <span className="badge bg-teal/10 text-teal">QE approved</span>}
            <span className="badge bg-slate-100">{inspector.status}</span>
          </div>
        </div>

        {canManageCerts && (
          <div className="mt-6 rounded-lg border border-slate-200 p-4">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(inspector.qeApproved)}
                disabled={qeBusy}
                onChange={async (e) => {
                  const next = e.target.checked;
                  setQeError('');
                  setQeBusy(true);
                  try {
                    await api.updateInspectorQeApproved(inspector.id, next);
                    await load();
                  } catch (err) {
                    setQeError(err instanceof Error ? err.message : 'Could not update QE approval');
                  } finally {
                    setQeBusy(false);
                  }
                }}
              />
              <span>
                <span className="text-sm font-medium text-navy">QE approved</span>
                <p className="text-xs text-slate-500 mt-0.5">
                  When set, this inspector is preferred for jobs that ask for a QE-approved inspector.
                </p>
              </span>
            </label>
            {qeError && <p className="text-sm text-red-600 mt-2">{qeError}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mt-6">
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-navy">{inspector.stats.activeAssignments}</div>
            <div className="text-xs text-slate-500">Active assignments</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-navy">{inspector.stats.allocatedHours}h</div>
            <div className="text-xs text-slate-500">Allocated hours</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-navy">{inspector.yearsExperience ?? 0}</div>
            <div className="text-xs text-slate-500">Years experience</div>
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <div className="text-2xl font-bold text-navy">{inspector.weeklyCapacityHrs ?? 40}h</div>
            <div className="text-xs text-slate-500">Weekly capacity</div>
          </div>
          {isAdminUser && (
            <>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-2xl font-bold text-navy">
                  {formatMoney(inspector.dailyCostUsd)}
                </div>
                <div className="text-xs text-slate-500">Daily CTC (QAR)</div>
              </div>
              <div className="rounded-lg bg-slate-50 p-3">
                <div className="text-2xl font-bold text-navy">
                  {formatMoney(inspector.dailyBillableUsd)}
                </div>
                <div className="text-xs text-slate-500">Daily billable (QAR)</div>
              </div>
            </>
          )}
        </div>

        {isAdminUser && (
          <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
            <h3 className="text-sm font-semibold text-navy">Update daily cost / billable</h3>
            <p className="text-xs text-slate-500">
              Provisional roster rates until HR confirms. Current values apply to new assignments (snapshotted at
              assign). History keeps earlier rates so past jobs are not silently rewritten.
            </p>
            <div className="grid sm:grid-cols-2 gap-3 max-w-lg">
              <div>
                <label className="text-xs text-slate-500">Daily CTC (QAR)</label>
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={costForm.dailyCostUsd}
                  onChange={(e) => setCostForm((f) => ({ ...f, dailyCostUsd: e.target.value }))}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Daily billable (QAR)</label>
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={costForm.dailyBillableUsd}
                  onChange={(e) => setCostForm((f) => ({ ...f, dailyBillableUsd: e.target.value }))}
                />
              </div>
            </div>
            {costError && <p className="text-sm text-red-600">{costError}</p>}
            <button
              type="button"
              className="btn-primary text-sm"
              disabled={savingCost}
              onClick={async () => {
                setCostError('');
                const dailyCostUsd = Number(costForm.dailyCostUsd);
                const dailyBillableUsd = Number(costForm.dailyBillableUsd);
                if (!Number.isFinite(dailyCostUsd) || !Number.isFinite(dailyBillableUsd)) {
                  setCostError('Enter valid QAR amounts.');
                  return;
                }
                setSavingCost(true);
                try {
                  await api.updateInspectorCosts(inspector.id, { dailyCostUsd, dailyBillableUsd });
                  await load();
                } catch (err) {
                  setCostError(err instanceof Error ? err.message : 'Could not save costs');
                } finally {
                  setSavingCost(false);
                }
              }}
            >
              {savingCost ? 'Saving…' : 'Save rates'}
            </button>
            {(inspector.costHistory ?? []).length > 0 && (
              <table className="w-full text-sm mt-2">
                <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
                  <tr>
                    <th className="py-2">Date</th>
                    <th className="py-2">CTC</th>
                    <th className="py-2">Billable</th>
                    <th className="py-2">Changed by</th>
                  </tr>
                </thead>
                <tbody>
                  {inspector.costHistory!.map((row) => (
                    <tr key={row.id} className="border-b border-slate-50">
                      <td className="py-2">{new Date(row.createdAt).toLocaleString()}</td>
                      <td className="py-2">{formatMoney(row.dailyCostUsd)}</td>
                      <td className="py-2">{formatMoney(row.dailyBillableUsd)}</td>
                      <td className="py-2 text-slate-500">{row.changedByEmail ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card p-6 space-y-4">
          <div>
            <h2 className="font-semibold text-navy">Certifications</h2>
            <p className="text-xs text-slate-500 mt-1">
              Validity is calculated from expiry date (≤90 days = expiring soon).
            </p>
          </div>

          {(inspector.inspectorCerts ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">No certifications on file.</p>
          ) : (
            <div className="space-y-3">
              {inspector.inspectorCerts!.map((c) => (
                <div key={c.id} className="rounded-lg border border-slate-100 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="font-medium text-navy">{c.certification.code}</div>
                      <div className="text-xs text-slate-500">{c.certification.name}</div>
                      <div className="text-xs text-slate-400 mt-1">
                        Issued {c.issuedOn.slice(0, 10)} · Expires {c.expiresOn.slice(0, 10)}
                      </div>
                    </div>
                    <span className={`badge ${certBadgeClass(c.status)}`}>{statusLabel(c.status)}</span>
                  </div>
                  {canManageCerts && (
                    <div className="flex gap-2 mt-3">
                      <button type="button" className="btn-secondary text-xs" onClick={() => startEdit(c)}>
                        Edit dates
                      </button>
                      <button
                        type="button"
                        className="text-xs text-red-600 hover:underline"
                        onClick={() => removeCert(c.id)}
                        disabled={savingCert}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {canManageCerts && (
            <div className="border-t border-slate-100 pt-4 space-y-3">
              <h3 className="text-sm font-semibold text-navy">
                {editingCertId ? 'Edit certification' : 'Add certification'}
              </h3>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className={editingCertId ? 'sm:col-span-2' : 'sm:col-span-2'}>
                  <label className="text-xs text-slate-500">Certification</label>
                  <select
                    className="input mt-1"
                    value={form.certificationId}
                    disabled={Boolean(editingCertId)}
                    onChange={(e) => setForm((f) => ({ ...f, certificationId: e.target.value }))}
                  >
                    <option value="">Select…</option>
                    {(editingCertId ? catalog : addOptions).map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.code} — {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs text-slate-500">Issued on</label>
                  <input
                    type="date"
                    className="input mt-1"
                    value={form.issuedOn}
                    onChange={(e) => setForm((f) => ({ ...f, issuedOn: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="text-xs text-slate-500">Expires on</label>
                  <input
                    type="date"
                    className="input mt-1"
                    value={form.expiresOn}
                    onChange={(e) => setForm((f) => ({ ...f, expiresOn: e.target.value }))}
                  />
                </div>
              </div>
              {certError && <p className="text-sm text-red-600">{certError}</p>}
              <div className="flex flex-wrap gap-2">
                <button type="button" className="btn-primary text-sm" onClick={saveCert} disabled={savingCert}>
                  {savingCert ? 'Saving…' : editingCertId ? 'Save changes' : 'Add certification'}
                </button>
                {editingCertId && (
                  <button type="button" className="btn-secondary text-sm" onClick={resetForm} disabled={savingCert}>
                    Cancel
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="card p-6">
          <h2 className="font-semibold text-navy mb-4">Leave</h2>
          {inspector.leaveRequests.length === 0 ? (
            <p className="text-sm text-slate-500">No leave recorded.</p>
          ) : (
            <div className="space-y-2">
              {inspector.leaveRequests.map((l) => (
                <div key={l.id} className="text-sm py-2 border-b border-slate-50 last:border-0">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{l.type}</span>
                    <span className="text-slate-500 text-xs">{l.startDate.slice(0, 10)} — {l.endDate.slice(0, 10)}</span>
                  </div>
                  {l.reason && <div className="text-slate-500 text-xs mt-1">{l.reason}</div>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-navy mb-4">Active assignments</h2>
        {active.length === 0 ? (
          <p className="text-sm text-slate-500">No active assignments.</p>
        ) : (
          <div className="space-y-3">
            {active.map((a) => {
              const overdue = isJobCurrentlyOverdue(a.job);
              return (
                <Link
                  key={a.id}
                  to={`/jobs/${a.job.id}`}
                  className={`block rounded-lg border p-4 transition-colors ${
                    overdue ? 'border-red-200 hover:border-red-300' : 'border-slate-100 hover:border-teal/40'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-medium text-navy">{a.job.ref} — {a.job.title}</div>
                    {overdue && (
                      <span className="badge bg-red-100 text-red-700" title="Past planned end date">
                        Overdue
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    {a.job.client.name} · {a.status}
                    {a.job.endDate ? ` · planned end ${a.job.endDate.slice(0, 10)}` : ''}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-navy mb-4">Recent activity</h2>
        {inspector.activityLogs.length === 0 ? (
          <p className="text-sm text-slate-500">No activity logged yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2">Date</th>
                <th className="py-2">Job</th>
                <th className="py-2">Hours</th>
                <th className="py-2">Notes</th>
              </tr>
            </thead>
            <tbody>
              {inspector.activityLogs.map((log) => {
                const jobOverdue = isJobCurrentlyOverdue(log.job);
                return (
                  <tr key={log.id} className="border-b border-slate-50">
                    <td className="py-2">{log.logDate.slice(0, 10)}</td>
                    <td className="py-2">
                      <Link
                        to={`/jobs/${log.job.id}`}
                        className={`hover:underline ${jobOverdue ? 'font-medium text-red-700' : 'text-teal'}`}
                        title={jobOverdue ? 'Job past planned end date' : undefined}
                      >
                        {log.job.ref}
                      </Link>
                    </td>
                    <td className="py-2">{log.hours}</td>
                    <td className="py-2 text-slate-600">{log.narrative ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="card p-6">
        <h2 className="font-semibold text-navy mb-4">Assignment history</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="py-2 pr-3">Job</th>
                <th className="py-2 pr-3">Client</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2">Hours</th>
              </tr>
            </thead>
            <tbody>
              {inspector.assignments.map((a) => (
                <tr key={a.id} className="border-b border-slate-50">
                  <td className="py-2 pr-3">
                    <Link to={`/jobs/${a.job.id}`} className="text-teal hover:underline">{a.job.ref}</Link>
                  </td>
                  <td className="py-2 pr-3">{a.job.client.name}</td>
                  <td className="py-2 pr-3"><span className="badge bg-slate-100">{a.status}</span></td>
                  <td className="py-2">{a.allocatedHours}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
