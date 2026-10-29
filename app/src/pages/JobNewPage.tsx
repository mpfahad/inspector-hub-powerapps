import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, type Certification, type Client, type Department, type JobType } from '../lib/api';

export function JobNewPage() {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [form, setForm] = useState({
    ref: `J-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    title: '',
    jobTypeId: '',
    clientId: '',
    departmentId: '',
    scope: '',
    location: '',
    startDate: '',
    endDate: '',
    priority: 'Normal',
    estimatedHours: '40',
    certificationIds: [] as number[],
    requiresQeApproval: false,
  });

  useEffect(() => {
    Promise.all([api.clients(), api.departments(), api.certifications(), api.jobTypes()]).then(
      ([c, d, cert, types]) => {
        setClients(c);
        setDepartments(d);
        setCerts(cert);
        setJobTypes(types);
        if (c[0]) setForm((f) => ({ ...f, clientId: String(c[0].id) }));
        if (d[0]) setForm((f) => ({ ...f, departmentId: String(d[0].id) }));
        if (types[0]) {
          setForm((f) => ({
            ...f,
            jobTypeId: String(types[0].id),
            certificationIds: types[0].certRequirements.map((r) => r.certification.id),
          }));
        }
      }
    );
  }, []);

  const applyJobType = (type: JobType, allCerts = certs) => {
    const certIds = type.certRequirements.map((r) => r.certification.id);
    setForm((f) => ({
      ...f,
      jobTypeId: String(type.id),
      title: f.title || type.name,
      certificationIds: certIds,
    }));
    if (!allCerts.length) return;
  };

  const onJobTypeChange = (jobTypeId: string) => {
    const type = jobTypes.find((t) => String(t.id) === jobTypeId);
    if (type) applyJobType(type);
    else setForm((f) => ({ ...f, jobTypeId, certificationIds: [] }));
  };

  const toggleCert = (id: number) => {
    setForm((f) => ({
      ...f,
      certificationIds: f.certificationIds.includes(id)
        ? f.certificationIds.filter((x) => x !== id)
        : [...f.certificationIds, id],
    }));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.requiresQeApproval) {
      const ok = window.confirm(
        'QE must approve the selected inspector before this job becomes Active. Hours cannot be logged until a manager (QE) approves. Continue?'
      );
      if (!ok) return;
    }
    const job = await api.createJob({
      ref: form.ref,
      title: form.title,
      jobTypeId: form.jobTypeId ? Number(form.jobTypeId) : undefined,
      clientId: Number(form.clientId),
      departmentId: Number(form.departmentId),
      scope: form.scope,
      location: form.location,
      startDate: form.startDate,
      endDate: form.endDate,
      priority: form.priority,
      estimatedHours: Number(form.estimatedHours),
      certificationIds: form.certificationIds,
      requiresQeApproval: form.requiresQeApproval,
    });
    const submitted = await api.submitJob(job.id);
    navigate(`/jobs/${(submitted as { job: { id: number } }).job.id}`);
  };

  const selectedType = jobTypes.find((t) => String(t.id) === form.jobTypeId);

  return (
    <div className="max-w-2xl">
      <form onSubmit={submit} className="card p-6 space-y-4">
        <div>
          <label className="text-xs font-medium">Job type</label>
          <select
            className="input mt-1"
            value={form.jobTypeId}
            onChange={(e) => onJobTypeChange(e.target.value)}
            required
          >
            <option value="">Select job type…</option>
            {jobTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.code} — {t.name}
              </option>
            ))}
          </select>
          {selectedType?.description && (
            <p className="text-xs text-slate-500 mt-1">{selectedType.description}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium">Job ref</label><input className="input mt-1" value={form.ref} onChange={(e) => setForm({ ...form, ref: e.target.value })} required /></div>
          <div><label className="text-xs font-medium">Priority</label>
            <select className="input mt-1" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {['Low', 'Normal', 'High', 'Critical'].map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
        </div>
        <div><label className="text-xs font-medium">Title</label><input className="input mt-1" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs font-medium">Client</label>
            <select className="input mt-1" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div><label className="text-xs font-medium">Department</label>
            <select className="input mt-1" value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })}>
              {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
        </div>
        <div><label className="text-xs font-medium">Scope</label><textarea className="input mt-1" rows={3} value={form.scope} onChange={(e) => setForm({ ...form, scope: e.target.value })} /></div>
        <div>
          <label className="text-xs font-medium">Location</label>
          <input
            className="input mt-1"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
            placeholder="e.g. Doha, Ras Laffan, Mesaieed"
          />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div><label className="text-xs font-medium">Start</label><input type="date" className="input mt-1" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} required /></div>
          <div><label className="text-xs font-medium">End</label><input type="date" className="input mt-1" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} required /></div>
          <div><label className="text-xs font-medium">Est. hours</label><input type="number" className="input mt-1" value={form.estimatedHours} onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })} /></div>
        </div>
        <div>
          <label className="text-xs font-medium">Required qualifications</label>
          <p className="text-xs text-slate-400 mb-2">Pre-filled from job type — adjust if needed</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {certs.map((c) => (
              <button key={c.id} type="button" onClick={() => toggleCert(c.id)}
                className={`badge ${form.certificationIds.includes(c.id) ? 'bg-teal/20 text-teal' : 'bg-slate-100 text-slate-600'}`}>
                {c.code}
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 p-4">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1"
              checked={form.requiresQeApproval}
              onChange={(e) => setForm({ ...form, requiresQeApproval: e.target.checked })}
            />
            <span>
              <span className="text-sm font-medium text-navy">Requires QE-approved inspector</span>
              <p className="text-xs text-slate-500 mt-0.5">
                If off, any eligible inspector can be assigned and the job becomes Active immediately.
                If on, you must assign someone already marked QE-approved on their inspector profile.
              </p>
            </span>
          </label>
        </div>
        <button type="submit" className="btn-primary">Create & submit for assignment</button>
        <p className="text-xs text-slate-500">Runs the assignment engine and adds the job to the board.</p>
      </form>
    </div>
  );
}
