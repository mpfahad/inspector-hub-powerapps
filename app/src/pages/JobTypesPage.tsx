import { useEffect, useRef, useState } from 'react';
import { api, type Certification, type JobType, type PriceChartData } from '../lib/api';
import { CURRENCY_CODE, formatMoney } from '../lib/money';

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
  const [types, setTypes] = useState<JobType[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [chart, setChart] = useState<PriceChartData | null>(null);
  const [globalPrice, setGlobalPrice] = useState('');
  const [typePrices, setTypePrices] = useState<Record<number, string>>({});
  const [chartError, setChartError] = useState('');
  const [savingChart, setSavingChart] = useState(false);

  const [createForm, setCreateForm] = useState<JobTypeForm>(emptyForm);
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<JobTypeForm>(emptyForm);
  const [editError, setEditError] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const editCardRef = useRef<HTMLDivElement | null>(null);

  const [qualCode, setQualCode] = useState('');
  const [qualName, setQualName] = useState('');
  const [qualError, setQualError] = useState('');
  const [savingQual, setSavingQual] = useState(false);
  const [showAddQual, setShowAddQual] = useState(false);

  const load = () =>
    Promise.all([api.jobTypesAll(), api.priceChart(), api.certifications()]).then(([t, c, q]) => {
      setTypes(t);
      setChart(c);
      setCerts(q);
      setGlobalPrice(String(c.globalDefaultUsd ?? ''));
      setTypePrices(
        Object.fromEntries(c.items.map((i) => [i.jobTypeId, i.priceUsd != null ? String(i.priceUsd) : '']))
      );
    });

  useEffect(() => {
    load().catch(() => undefined);
  }, []);

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
    code: form.code.trim(),
    name: form.name.trim(),
    description: form.description.trim() || undefined,
    certificationIds: form.certificationIds,
    defaultPriceUsd: form.defaultPriceUsd ? Number(form.defaultPriceUsd) : undefined,
  });

  const createType = async () => {
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

  const addQualification = async () => {
    setQualError('');
    if (!qualCode.trim() || !qualName.trim()) {
      setQualError('Code and name are required.');
      return;
    }
    setSavingQual(true);
    try {
      const created = await api.createCertification({
        code: qualCode.trim(),
        name: qualName.trim(),
      });
      setCerts((prev) => [...prev, created].sort((a, b) => a.code.localeCompare(b.code)));
      setQualCode('');
      setQualName('');
      setShowAddQual(false);
      // Auto-select on the open editor if editing/creating
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
    } catch (err) {
      setQualError(err instanceof Error ? err.message : 'Could not add qualification');
    } finally {
      setSavingQual(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-navy">Job types & qualifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            Define inspection categories and required certifications. Prices live in the chart on the right.
          </p>
        </div>
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
      </div>

      <div className="grid lg:grid-cols-[minmax(0,1.4fr)_minmax(280px,0.9fr)] gap-6 items-start">
        <div className="space-y-4 min-w-0">
          {showCreate && (
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

          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div>
                <h2 className="text-sm font-semibold text-navy">Qualifications catalog</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {certs.length} available — toggle them on a job type while editing.
                </p>
              </div>
              <button
                type="button"
                className="btn-secondary text-xs shrink-0"
                onClick={() => {
                  setShowAddQual((v) => !v);
                  setQualError('');
                }}
              >
                {showAddQual ? 'Cancel' : '+ Add qualification'}
              </button>
            </div>
            {showAddQual && (
              <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3 space-y-3">
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
                <button type="button" className="btn-primary text-sm" disabled={savingQual} onClick={addQualification}>
                  {savingQual ? 'Saving…' : 'Save qualification'}
                </button>
              </div>
            )}
            <div className="flex flex-wrap gap-1.5">
              {certs.map((c) => (
                <span key={c.id} className="badge bg-slate-100 text-slate-600" title={c.name}>
                  {c.code}
                </span>
              ))}
              {certs.length === 0 && <span className="text-xs text-slate-400">No qualifications yet.</span>}
            </div>
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
                    <button
                      type="button"
                      className="btn-secondary text-xs shrink-0"
                      onClick={() => startEdit(type)}
                    >
                      Edit
                    </button>
                  </div>
                )}
              </div>
            );
          })}

          {types.length === 0 && (
            <p className="text-sm text-slate-500 card p-6">No job types yet. Add one to get started.</p>
          )}
        </div>

        <aside className="lg:sticky lg:top-6 space-y-4">
          {chart && (
            <form
              className="card p-5 space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setChartError('');
                setSavingChart(true);
                try {
                  await api.updatePriceChart({
                    globalDefaultUsd: Number(globalPrice),
                    items: chart.items.map((i) => ({
                      jobTypeId: i.jobTypeId,
                      priceUsd: Number(typePrices[i.jobTypeId] || 0),
                    })),
                  });
                  await load();
                } catch (err) {
                  setChartError(err instanceof Error ? err.message : 'Could not save price chart');
                } finally {
                  setSavingChart(false);
                }
              }}
            >
              <div>
                <h2 className="font-semibold text-navy">Price chart ({CURRENCY_CODE})</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Default commercial price copied onto a job when it is assigned. Inspector CTC/billable stay separate.
                </p>
              </div>
              <div>
                <label className="text-xs font-medium text-slate-500">Global default</label>
                <input
                  className="input mt-1"
                  type="number"
                  min="0"
                  value={globalPrice}
                  onChange={(e) => setGlobalPrice(e.target.value)}
                />
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs text-slate-500 border-b border-slate-100 sticky top-0 bg-white">
                    <tr>
                      <th className="py-2 pr-2">Job type</th>
                      <th className="py-2">Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chart.items.map((item) => (
                      <tr key={item.jobTypeId} className="border-b border-slate-50">
                        <td className="py-2 pr-2">
                          <div className="font-medium text-navy text-xs">{item.code}</div>
                          <div className="text-xs text-slate-500">{item.name}</div>
                        </td>
                        <td className="py-2">
                          <input
                            className="input max-w-[110px] text-sm"
                            type="number"
                            min="0"
                            value={typePrices[item.jobTypeId] ?? ''}
                            onChange={(e) =>
                              setTypePrices((p) => ({ ...p, [item.jobTypeId]: e.target.value }))
                            }
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {chartError && <p className="text-sm text-red-600">{chartError}</p>}
              <button type="submit" className="btn-primary w-full" disabled={savingChart}>
                {savingChart ? 'Saving…' : 'Save price chart'}
              </button>
            </form>
          )}
        </aside>
      </div>
    </div>
  );
}
