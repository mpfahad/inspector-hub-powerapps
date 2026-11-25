import { useEffect, useRef, useState } from 'react';
import { api, type Certification, type JobType } from '../lib/api';
import { CURRENCY_CODE, formatMoney } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';
import { parseDelimitedRows, rowsSkipHeader } from '../lib/csv';

type JobTypeForm = {
  code: string;
  name: string;
  description: string;
  certificationIds: number[];
  dayRateUsd: string;
  hourRateUsd: string;
  defaultHours: string;
};

const emptyForm: JobTypeForm = {
  code: '',
  name: '',
  description: '',
  certificationIds: [],
  dayRateUsd: '',
  hourRateUsd: '',
  defaultHours: '8',
};

type RateField = 'dayRateUsd' | 'hourRateUsd' | 'defaultHours';

function parseOpt(s: string): number | null {
  if (s.trim() === '') return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Any two of day / hour / default hours → fill the third. */
function applyLinkedRates(form: JobTypeForm, changed: RateField, raw: string): JobTypeForm {
  const next = { ...form, [changed]: raw };
  let day = parseOpt(next.dayRateUsd);
  let hour = parseOpt(next.hourRateUsd);
  let hours = parseOpt(next.defaultHours);

  if (changed === 'dayRateUsd' || changed === 'defaultHours') {
    if (day != null && hours != null && hours > 0) {
      hour = Math.round((day / hours) * 100) / 100;
      next.hourRateUsd = String(hour);
    } else if (day != null && hour != null && hour > 0 && changed === 'dayRateUsd') {
      hours = Math.round((day / hour) * 10) / 10;
      next.defaultHours = String(hours);
    }
  } else if (changed === 'hourRateUsd') {
    if (hour != null && hours != null && hours > 0) {
      day = Math.round(hour * hours * 100) / 100;
      next.dayRateUsd = String(day);
    } else if (day != null && hour != null && hour > 0) {
      hours = Math.round((day / hour) * 10) / 10;
      next.defaultHours = String(hours);
    }
  }
  return next;
}

function JobTypeEditor({
  form,
  setForm,
  certs,
  saving,
  error,
  submitLabel,
  onSubmit,
  onCancel,
  showCancel,
}: {
  form: JobTypeForm;
  setForm: (next: JobTypeForm | ((prev: JobTypeForm) => JobTypeForm)) => void;
  certs: Certification[];
  saving: boolean;
  error: string;
  submitLabel: string;
  onSubmit: () => void;
  onCancel?: () => void;
  showCancel?: boolean;
}) {
  const toggleCert = (id: number) => {
    setForm((f) => ({
      ...f,
      certificationIds: f.certificationIds.includes(id)
        ? f.certificationIds.filter((x) => x !== id)
        : [...f.certificationIds, id],
    }));
  };

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs text-slate-500">Code</label>
          <input
            className="input mt-1"
            value={form.code}
            onChange={(e) => setForm({ ...form, code: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs text-slate-500">Name</label>
          <input
            className="input mt-1"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500">Description</label>
        <textarea
          className="input mt-1"
          rows={2}
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>
      <div className="rounded-lg border border-slate-100 bg-slate-50/60 p-3 space-y-2">
        <p className="text-xs text-slate-500">
          Rates ({CURRENCY_CODE}) — enter any two; the third calculates automatically.
        </p>
        <div className="grid sm:grid-cols-3 gap-3">
          <div>
            <label className="text-xs text-slate-500">Day rate</label>
            <input
              className="input mt-1"
              type="number"
              min="0"
              step="0.01"
              value={form.dayRateUsd}
              onChange={(e) => setForm(applyLinkedRates(form, 'dayRateUsd', e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Hour rate</label>
            <input
              className="input mt-1"
              type="number"
              min="0"
              step="0.01"
              value={form.hourRateUsd}
              onChange={(e) => setForm(applyLinkedRates(form, 'hourRateUsd', e.target.value))}
            />
          </div>
          <div>
            <label className="text-xs text-slate-500">Default hours / day</label>
            <input
              className="input mt-1"
              type="number"
              min="0"
              max="24"
              step="0.1"
              value={form.defaultHours}
              onChange={(e) => setForm(applyLinkedRates(form, 'defaultHours', e.target.value))}
            />
          </div>
        </div>
      </div>
      <div>
        <label className="text-xs text-slate-500">Required qualifications</label>
        <div className="flex flex-wrap gap-2 mt-2">
          {certs.length === 0 ? (
            <span className="text-xs text-slate-400">No qualifications yet — add one in the panel below.</span>
          ) : (
            certs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCert(c.id)}
                className={`badge ${
                  form.certificationIds.includes(c.id) ? 'bg-teal/20 text-teal' : 'bg-slate-100 text-slate-600'
                }`}
                title={c.name}
              >
                {c.code}
              </button>
            ))
          )}
        </div>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn-primary text-sm" disabled={saving}>
          {saving ? 'Saving…' : submitLabel}
        </button>
        {showCancel && onCancel && (
          <button type="button" className="btn-secondary text-sm" disabled={saving} onClick={onCancel}>
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

export function JobTypesPage() {
  const { user } = useAuth();
  const { department, loading: deptLoading } = useDepartment();
  const canManage = ['Coordinator', 'Manager', 'Admin'].includes(user?.role ?? '');
  const [types, setTypes] = useState<JobType[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);

  const [createForm, setCreateForm] = useState<JobTypeForm>(emptyForm);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [bulkText, setBulkText] = useState('');
  const [bulkResult, setBulkResult] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<JobTypeForm>(emptyForm);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [listError, setListError] = useState('');
  const editCardRef = useRef<HTMLDivElement | null>(null);

  const [qualCode, setQualCode] = useState('');
  const [qualName, setQualName] = useState('');
  const [qualError, setQualError] = useState('');
  const [savingQual, setSavingQual] = useState(false);
  const [deletingQual, setDeletingQual] = useState(false);
  const [showAddQual, setShowAddQual] = useState(false);
  const [editingQualId, setEditingQualId] = useState<number | null>(null);

  const load = () => {
    if (!department) return Promise.resolve();
    return Promise.all([
      api.jobTypesAll({ departmentId: department.id }),
      api.certifications(),
    ]).then(([t, q]) => {
      setTypes(t);
      setCerts(q);
    });
  };

  useEffect(() => {
    load().catch(() => undefined);
  }, [department?.id]);

  const startEdit = (type: JobType) => {
    setEditingId(type.id);
    setEditError('');
    setEditForm({
      code: type.code,
      name: type.name,
      description: type.description ?? '',
      certificationIds: type.certRequirements.map((r) => r.certification.id),
      dayRateUsd:
        type.dayRateUsd != null
          ? String(type.dayRateUsd)
          : type.defaultPriceUsd != null
            ? String(type.defaultPriceUsd)
            : '',
      hourRateUsd: type.hourRateUsd != null ? String(type.hourRateUsd) : '',
      defaultHours: type.defaultHours != null ? String(type.defaultHours) : '8',
    });
    setShowCreate(false);
    requestAnimationFrame(() => {
      editCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditForm(emptyForm);
    setEditError('');
  };

  const payloadFrom = (form: JobTypeForm) => ({
    departmentId: department!.id,
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    certificationIds: form.certificationIds,
    dayRateUsd: form.dayRateUsd ? Number(form.dayRateUsd) : null,
    hourRateUsd: form.hourRateUsd ? Number(form.hourRateUsd) : null,
    defaultHours: form.defaultHours ? Number(form.defaultHours) : null,
    defaultPriceUsd: form.dayRateUsd ? Number(form.dayRateUsd) : null,
  });

  const createType = async () => {
    if (!department) return;
    setCreateError('');
    setCreating(true);
    try {
      await api.createJobType(payloadFrom(createForm));
      setCreateForm(emptyForm);
      setShowCreate(false);
      await load();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create job type');
    } finally {
      setCreating(false);
    }
  };

  const runBulkImport = async () => {
    if (!department) return;
    setListError('');
    setBulkResult('');
    const rows = rowsSkipHeader(parseDelimitedRows(bulkText), ['code', 'name', 'job']);
    if (rows.length === 0) {
      setListError('Paste CSV: code, name, description, dayRate, defaultHours, active, requiredCertCodes');
      return;
    }
    const jobTypes = rows.map((r) => ({
      code: r[0] ?? '',
      name: r[1] ?? '',
      description: r[2] || null,
      dayRateUsd: r[3] ? Number(r[3]) : null,
      defaultHours: r[4] ? Number(r[4]) : 8,
      active: !/^(no|n|false|0)$/i.test(r[5] ?? 'Yes'),
      requiredCertCodes: r[6] || null,
    }));
    setBulkBusy(true);
    try {
      const res = await api.bulkImportJobTypes({ departmentId: department.id, jobTypes });
      setBulkResult(
        `Created ${res.created.length}, updated ${res.updated.length}, errors ${res.errors.length}` +
          (res.errors.length ? `\n${res.errors.map((e) => `${e.code}: ${e.error}`).join('\n')}` : '')
      );
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setBulkBusy(false);
    }
  };

  const saveEdit = async () => {
    if (editingId == null) return;
    setEditError('');
    setSavingEdit(true);
    try {
      await api.updateJobType(editingId, payloadFrom(editForm));
      cancelEdit();
      await load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Could not save job type');
    } finally {
      setSavingEdit(false);
    }
  };

  const deleteType = async (type: JobType) => {
    if (
      !window.confirm(
        `Delete job type ${type.code}? Open jobs using it must be closed/cancelled first. Closed jobs keep history with the type cleared.`
      )
    ) {
      return;
    }
    setDeletingId(type.id);
    setListError('');
    try {
      await api.deleteJobType(type.id);
      if (editingId === type.id) cancelEdit();
      await load();
    } catch (err) {
      setListError(err instanceof Error ? err.message : 'Could not delete job type');
    } finally {
      setDeletingId(null);
    }
  };

  const startEditQual = (c: Certification) => {
    if (!canManage) return;
    setEditingQualId(c.id);
    setQualCode(c.code);
    setQualName(c.name);
    setShowAddQual(true);
    setQualError('');
  };

  const cancelQualForm = () => {
    setShowAddQual(false);
    setEditingQualId(null);
    setQualCode('');
    setQualName('');
    setQualError('');
  };

  const saveQualification = async () => {
    setQualError('');
    if (!qualCode.trim() || !qualName.trim()) {
      setQualError('Code and name are required.');
      return;
    }
    setSavingQual(true);
    try {
      if (editingQualId != null) {
        const updated = await api.updateCertification(editingQualId, {
          code: qualCode.trim(),
          name: qualName.trim(),
        });
        setCerts((prev) =>
          prev.map((c) => (c.id === updated.id ? updated : c)).sort((a, b) => a.code.localeCompare(b.code))
        );
      } else {
        const created = await api.createCertification({
          code: qualCode.trim(),
          name: qualName.trim(),
        });
        setCerts((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));
        if (editingId != null) {
          setEditForm((f) =>
            f.certificationIds.includes(created.id)
              ? f
              : { ...f, certificationIds: [...f.certificationIds, created.id] }
          );
        } else if (showCreate) {
          setCreateForm((f) =>
            f.certificationIds.includes(created.id)
              ? f
              : { ...f, certificationIds: [...f.certificationIds, created.id] }
          );
        }
      }
      cancelQualForm();
    } catch (err) {
      setQualError(err instanceof Error ? err.message : 'Could not save qualification');
    } finally {
      setSavingQual(false);
    }
  };

  const deleteQualification = async () => {
    if (editingQualId == null) return;
    const code = qualCode.trim() || 'this qualification';
    if (
      !window.confirm(
        `Delete ${code} from the catalog?\n\nThis also removes it from any job types and inspector competency records that use it.`
      )
    ) {
      return;
    }
    setDeletingQual(true);
    setQualError('');
    try {
      const id = editingQualId;
      await api.deleteCertification(id);
      setCerts((prev) => prev.filter((c) => c.id !== id));
      setEditForm((f) => ({
        ...f,
        certificationIds: f.certificationIds.filter((x) => x !== id),
      }));
      setCreateForm((f) => ({
        ...f,
        certificationIds: f.certificationIds.filter((x) => x !== id),
      }));
      cancelQualForm();
    } catch (err) {
      setQualError(err instanceof Error ? err.message : 'Could not delete qualification');
    } finally {
      setDeletingQual(false);
    }
  };

  if (deptLoading || !department) {
    return <p className="text-sm text-slate-500">Loading department…</p>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Job types · {department.name}</h1>
          <p className="text-sm text-slate-500 mt-1">
            Categories, certifications, and default commercial price for this department. Set price when
            editing a job type.
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                cancelEdit();
                setShowCreate(false);
                setShowBulk((v) => !v);
                setBulkResult('');
              }}
            >
              {showBulk ? 'Cancel bulk' : 'Bulk upload'}
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={() => {
                cancelEdit();
                setShowBulk(false);
                setShowCreate((v) => !v);
                setCreateError('');
              }}
            >
              {showCreate ? 'Cancel' : '+ New job type'}
            </button>
          </div>
        )}
      </div>

      <div className="space-y-4 max-w-4xl">
          {canManage && showBulk && (
            <div className="card p-5 space-y-3 border-teal/30">
              <h2 className="text-sm font-semibold text-navy">Bulk upload job types · {department.name}</h2>
              <p className="text-xs text-slate-500">
                CSV:{' '}
                <span className="font-mono">
                  code, name, description, dayRate, defaultHours, active, requiredCertCodes
                </span>
                . Cert codes pipe-separated (e.g. <span className="font-mono">IRATA-L1|IRATA-L2</span>).
              </p>
              <textarea
                className="input font-mono text-xs min-h-[140px]"
                placeholder={
                  'code,name,description,dayRate,defaultHours,active,requiredCertCodes\nRA-TECH,Rope Access Tech,IRATA support,2200,8,Yes,IRATA-L1'
                }
                value={bulkText}
                onChange={(e) => setBulkText(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={bulkBusy}
                  onClick={runBulkImport}
                >
                  {bulkBusy ? 'Importing…' : 'Import job types'}
                </button>
                <button type="button" className="btn-secondary text-sm" onClick={() => setShowBulk(false)}>
                  Close
                </button>
              </div>
              {bulkResult && <pre className="text-xs text-slate-600 whitespace-pre-wrap">{bulkResult}</pre>}
            </div>
          )}

          {canManage && showCreate && (
            <div className="card p-5 space-y-3 border-teal/30">
              <h2 className="text-sm font-semibold text-navy">Add job type</h2>
              <JobTypeEditor
                form={createForm}
                setForm={setCreateForm}
                certs={certs}
                saving={creating}
                error={createError}
                submitLabel="Add job type"
                onSubmit={createType}
                showCancel
                onCancel={() => {
                  setShowCreate(false);
                  setCreateForm(emptyForm);
                  setCreateError('');
                }}
              />
            </div>
          )}

          {listError && <p className="text-sm text-red-600">{listError}</p>}

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-navy">Qualifications catalog</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {certs.length} available — toggle them on a job type while editing.
                </p>
              </div>
              {canManage && (
                <button
                  type="button"
                  className="btn-secondary text-xs shrink-0"
                  onClick={() => {
                    if (showAddQual) cancelQualForm();
                    else {
                      setEditingQualId(null);
                      setQualCode('');
                      setQualName('');
                      setShowAddQual(true);
                      setQualError('');
                    }
                  }}
                >
                  {showAddQual ? 'Cancel' : '+ Add qualification'}
                </button>
              )}
            </div>
            {canManage && showAddQual && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
                <p className="text-xs font-medium text-navy">
                  {editingQualId ? 'Edit qualification' : 'New qualification'}
                </p>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-slate-500">Code *</label>
                    <input
                      className="input mt-1"
                      placeholder="e.g. CSWIP"
                      value={qualCode}
                      onChange={(e) => setQualCode(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500">Name *</label>
                    <input
                      className="input mt-1"
                      placeholder="e.g. CSWIP 3.1 Welding Inspector"
                      value={qualName}
                      onChange={(e) => setQualName(e.target.value)}
                    />
                  </div>
                </div>
                {qualError && <p className="text-sm text-red-600">{qualError}</p>}
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn-primary text-sm"
                    disabled={savingQual || deletingQual}
                    onClick={saveQualification}
                  >
                    {savingQual ? 'Saving…' : editingQualId ? 'Save changes' : 'Save qualification'}
                  </button>
                  {editingQualId != null && (
                    <button
                      type="button"
                      className="btn-secondary text-sm text-red-700 border-red-200"
                      disabled={savingQual || deletingQual}
                      onClick={deleteQualification}
                    >
                      {deletingQual ? 'Deleting…' : 'Delete'}
                    </button>
                  )}
                </div>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {certs.map((c) =>
                canManage ? (
                  <button
                    key={c.id}
                    type="button"
                    className="badge bg-slate-100 text-slate-600 hover:bg-teal/10 hover:text-navy"
                    title={`${c.name} — click to edit`}
                    onClick={() => startEditQual(c)}
                  >
                    {c.code}
                  </button>
                ) : (
                  <span key={c.id} className="badge bg-slate-100 text-slate-600" title={c.name}>
                    {c.code}
                  </span>
                )
              )}
              {certs.length === 0 && <span className="text-xs text-slate-400">No qualifications yet.</span>}
            </div>
            {canManage && (
              <p className="text-[11px] text-slate-400">
                Click a qualification badge to edit or delete it from the catalog.
              </p>
            )}
          </div>

          {types.map((type) => {
            const isEditing = editingId === type.id;
            return (
              <div
                key={type.id}
                ref={isEditing ? editCardRef : undefined}
                className={`card p-5 ${isEditing ? 'ring-1 ring-teal/40' : ''}`}
              >
                {isEditing ? (
                  <div className="space-y-3">
                    <h2 className="text-sm font-semibold text-navy">Edit job type</h2>
                    <JobTypeEditor
                      form={editForm}
                      setForm={setEditForm}
                      certs={certs}
                      saving={savingEdit}
                      error={editError}
                      submitLabel="Save changes"
                      onSubmit={saveEdit}
                      showCancel
                      onCancel={cancelEdit}
                    />
                  </div>
                ) : (
                  <div className="flex justify-between items-start gap-4">
                    <div className="min-w-0">
                      <div className="font-semibold text-navy">
                        {type.code} — {type.name}
                      </div>
                      {type.description && <p className="text-sm text-slate-500 mt-1">{type.description}</p>}
                      <div className="text-xs text-slate-500 mt-1 space-y-0.5">
                        {(type.dayRateUsd ?? type.defaultPriceUsd) != null && (
                          <p>Day rate {formatMoney(type.dayRateUsd ?? type.defaultPriceUsd)}</p>
                        )}
                        {type.hourRateUsd != null && <p>Hour rate {formatMoney(type.hourRateUsd)}</p>}
                        {type.defaultHours != null && <p>Default {type.defaultHours}h / day</p>}
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        {type.certRequirements.length === 0 ? (
                          <span className="text-xs text-slate-400">No qualifications required</span>
                        ) : (
                          type.certRequirements.map((r) => (
                            <span
                              key={r.certification.id}
                              className="badge bg-teal/10 text-teal"
                              title={r.certification.name}
                            >
                              {r.certification.code}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex flex-col gap-2 shrink-0">
                        <button
                          type="button"
                          className="btn-secondary text-xs"
                          onClick={() => startEdit(type)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn-secondary text-xs text-red-700 border-red-200"
                          disabled={deletingId === type.id}
                          onClick={() => deleteType(type)}
                        >
                          {deletingId === type.id ? 'Deleting…' : 'Delete'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {types.length === 0 && (
            <p className="text-sm text-slate-500 card p-6">No job types yet. Add one to get started.</p>
          )}
      </div>
    </div>
  );
}
