import { useEffect, useState } from 'react';
import { api, type Certification, type JobType, type PriceChartData } from '../lib/api';
import { CURRENCY_CODE, formatMoney } from '../lib/money';

export function JobTypesPage() {
  const [types, setTypes] = useState<JobType[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [chart, setChart] = useState<PriceChartData | null>(null);
  const [globalPrice, setGlobalPrice] = useState('');
  const [typePrices, setTypePrices] = useState<Record<number, string>>({});
  const [chartError, setChartError] = useState('');
  const [savingChart, setSavingChart] = useState(false);
  const [form, setForm] = useState({
    code: '',
    name: '',
    description: '',
    certificationIds: [] as number[],
    defaultPriceUsd: '',
  });
  const [editingId, setEditingId] = useState<number | null>(null);

  const load = () =>
    Promise.all([api.jobTypesAll(), api.priceChart()]).then(([t, c]) => {
      setTypes(t);
      setChart(c);
      setGlobalPrice(String(c.globalDefaultUsd ?? ''));
      setTypePrices(Object.fromEntries(c.items.map((i) => [i.jobTypeId, i.priceUsd != null ? String(i.priceUsd) : ''])));
    });

  useEffect(() => {
    Promise.all([load(), api.certifications()]).then(([, c]) => setCerts(c));
  }, []);

  const toggleCert = (id: number) => {
    setForm((f) => ({
      ...f,
      certificationIds: f.certificationIds.includes(id)
        ? f.certificationIds.filter((x) => x !== id)
        : [...f.certificationIds, id],
    }));
  };

  const resetForm = () => {
    setForm({ code: '', name: '', description: '', certificationIds: [], defaultPriceUsd: '' });
    setEditingId(null);
  };

  const startEdit = (type: JobType) => {
    setEditingId(type.id);
    setForm({
      code: type.code,
      name: type.name,
      description: type.description ?? '',
      certificationIds: type.certRequirements.map((r) => r.certification.id),
      defaultPriceUsd: type.defaultPriceUsd != null ? String(type.defaultPriceUsd) : '',
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...form,
      defaultPriceUsd: form.defaultPriceUsd ? Number(form.defaultPriceUsd) : undefined,
    };
    if (editingId) {
      await api.updateJobType(editingId, payload);
    } else {
      await api.createJobType(payload);
    }
    resetForm();
    load();
  };

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-navy">Job types & qualifications</h1>
        <p className="text-sm text-slate-500 mt-1">
          Define inspection job categories, default prices ({CURRENCY_CODE}), and the certifications required for each
        </p>
      </div>

      {chart && (
        <form
          className="card p-6 space-y-4"
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
          <div className="max-w-xs">
            <label className="text-xs font-medium">Global default</label>
            <input className="input mt-1" type="number" min="0" value={globalPrice} onChange={(e) => setGlobalPrice(e.target.value)} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="py-2">Job type</th>
                  <th className="py-2">Default price ({CURRENCY_CODE})</th>
                </tr>
              </thead>
              <tbody>
                {chart.items.map((item) => (
                  <tr key={item.jobTypeId} className="border-b border-slate-50">
                    <td className="py-2 pr-3">{item.code} — {item.name}</td>
                    <td className="py-2">
                      <input
                        className="input max-w-[140px]"
                        type="number"
                        min="0"
                        value={typePrices[item.jobTypeId] ?? ''}
                        onChange={(e) => setTypePrices((p) => ({ ...p, [item.jobTypeId]: e.target.value }))}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {chartError && <p className="text-sm text-red-600">{chartError}</p>}
          <button type="submit" className="btn-primary" disabled={savingChart}>
            {savingChart ? 'Saving…' : 'Save price chart'}
          </button>
        </form>
      )}

      <form onSubmit={submit} className="card p-6 space-y-4">
        <h2 className="font-semibold text-navy">{editingId ? 'Edit job type' : 'Add job type'}</h2>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Code</label>
            <input className="input mt-1" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} required />
          </div>
          <div>
            <label className="text-xs font-medium">Name</label>
            <input className="input mt-1" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
        </div>
        <div>
          <label className="text-xs font-medium">Description</label>
          <textarea className="input mt-1" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="text-xs font-medium">Default price ({CURRENCY_CODE})</label>
          <input
            className="input mt-1"
            type="number"
            min="0"
            value={form.defaultPriceUsd}
            onChange={(e) => setForm({ ...form, defaultPriceUsd: e.target.value })}
          />
        </div>
        <div>
          <label className="text-xs font-medium">Required qualifications</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {certs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCert(c.id)}
                className={`badge ${form.certificationIds.includes(c.id) ? 'bg-teal/20 text-teal' : 'bg-slate-100 text-slate-600'}`}
              >
                {c.code}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2">
          <button type="submit" className="btn-primary">{editingId ? 'Save changes' : 'Add job type'}</button>
          {editingId && (
            <button type="button" className="btn-secondary" onClick={resetForm}>Cancel</button>
          )}
        </div>
      </form>

      <div className="space-y-4">
        {types.map((type) => (
          <div key={type.id} className="card p-5">
            <div className="flex justify-between items-start gap-4">
              <div>
                <div className="font-semibold text-navy">{type.code} — {type.name}</div>
                {type.description && <p className="text-sm text-slate-500 mt-1">{type.description}</p>}
                {type.defaultPriceUsd != null && (
                  <p className="text-xs text-slate-500 mt-1">Default price {formatMoney(type.defaultPriceUsd)}</p>
                )}
                <div className="flex flex-wrap gap-2 mt-3">
                  {type.certRequirements.length === 0 ? (
                    <span className="text-xs text-slate-400">No qualifications required</span>
                  ) : (
                    type.certRequirements.map((r) => (
                      <span key={r.certification.id} className="badge bg-teal/10 text-teal">{r.certification.code}</span>
                    ))
                  )}
                </div>
              </div>
              <button type="button" className="btn-secondary text-xs shrink-0" onClick={() => startEdit(type)}>
                Edit
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
