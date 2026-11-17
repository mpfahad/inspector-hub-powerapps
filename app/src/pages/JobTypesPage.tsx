import { useEffect, useRef, useState } from 'react';
import { api, type Certification, type JobType } from '../lib/api';
import { CURRENCY_CODE, formatMoney } from '../lib/money';
import { useAuth } from '../context/AuthContext';
import { useDepartment } from '../context/DepartmentContext';

type JobTypeForm = {
  code: string;
  name: string;
  description: string;
  certificationIds: number[];
  defaultPriceUsd: string;
};

const emptyForm: JobTypeForm = {
  code: '',
  name: '',
  description: '',
  certificationIds: [],
  defaultPriceUsd: '',
};

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
      <div>
        <label className="text-xs text-slate-500">Default price ({CURRENCY_CODE})</label>
        <input
          className="input mt-1 max-w-[160px]"
          type="number"
          min="0"
          value={form.defaultPriceUsd}
          onChange={(e) => setForm({ ...form, defaultPriceUsd: e.target.value })}
        />
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
      defaultPriceUsd: type.defaultPriceUsd != null ? String(type.defaultPriceUsd) : '',
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
    defaultPriceUsd: form.defaultPriceUsd ? Number(form.defaultPriceUsd) : undefined,
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
          <button
            type="button"
            className="btn-primary shrink-0"
            onClick={() => {
              cancelEdit();
              setShowCreate((v) => !v);
              setCreateError('');
            }}
          >
            {showCreate ? 'Cancel' : '+ New job type'}
          </button>
        )}
      </div>

      <div className="space-y-4 max-w-4xl">
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
                <button
                  type="button"
                  className="btn-primary text-sm"
                  disabled={savingQual}
                  onClick={saveQualification}
                >
                  {savingQual ? 'Saving…' : editingQualId ? 'Save changes' : 'Save qualification'}
                </button>
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
              <p className="text-[11px] text-slate-400">Click a qualification badge to edit its code or name.</p>
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
                      {type.defaultPriceUsd != null && (
                        <p className="text-xs text-slate-500 mt-1">
                          Default price {formatMoney(type.defaultPriceUsd)}
                        </p>
                      )}
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
