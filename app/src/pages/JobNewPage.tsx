import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  api,
  type Certification,
  type Client,
  type DuplicateJobHit,
  type Inspector,
  type JobType,
} from '../lib/api';
import { useDepartment } from '../context/DepartmentContext';
import { statusLabel } from '../lib/jobs';
import {
  emptyTeamSlots,
  filledTeamSlots,
  inclusiveDays,
  TeamSlotsEditor,
  type TeamSlot,
} from '../components/jobs/TeamSlotsEditor';

function hoursPerDay(type?: JobType | null): number {
  const h = type?.defaultHours;
  return h != null && Number.isFinite(h) && h > 0 ? h : 8;
}

/** Job-type default hours × inclusive calendar days × inspectors needed. */
function suggestEstimatedHours(
  type: JobType | null | undefined,
  startDate: string,
  endDate: string,
  teamSize: number
): string {
  const days = inclusiveDays(startDate, endDate);
  const total = hoursPerDay(type) * Math.max(1, days || 1) * Math.max(1, teamSize);
  return String(Math.round(total * 100) / 100);
}

type AssignMode = 'later' | 'now';
type AssignmentShape = 'single' | 'team';
type RateBasis = 'day' | 'hourly';
type CompletionMode = 'auto' | 'manual';

function SegToggle<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  const set = (v: string) => onChange(v as T);
  return (
    <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className={`flex-1 px-2.5 py-1.5 text-xs rounded-md transition-colors ${
            value === o.value ? 'bg-white text-navy font-medium shadow-sm' : 'text-slate-600 hover:text-navy'
          }`}
          onClick={() => set(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function JobNewPage() {
  const navigate = useNavigate();
  const { department, deptPath, loading: deptLoading } = useDepartment();
  const [clients, setClients] = useState<Client[]>([]);
  const [certs, setCerts] = useState<Certification[]>([]);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [inspectors, setInspectors] = useState<Inspector[]>([]);
  const [duplicates, setDuplicates] = useState<DuplicateJobHit[]>([]);
  const [dupAck, setDupAck] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completionMode, setCompletionMode] = useState<CompletionMode>('auto');
  const [assignmentShape, setAssignmentShape] = useState<AssignmentShape>('single');
  const [rateBasis, setRateBasis] = useState<RateBasis>('day');
  const [assignMode, setAssignMode] = useState<AssignMode>('later');
  const [teamSlots, setTeamSlots] = useState<TeamSlot[]>([]);
  const [form, setForm] = useState({
    ref: `J-${new Date().getFullYear()}-${String(Math.floor(Math.random() * 900) + 100)}`,
    title: '',
    jobTypeId: '',
    clientId: '',
    scope: '',
    location: '',
    startDate: '',
    endDate: '',
    priority: 'Normal',
    estimatedHours: '8',
    requiredInspectorCount: '1',
    certificationIds: [] as number[],
    requiresQeApproval: false,
  });

  const teamSize =
    assignmentShape === 'single'
      ? 1
      : Math.min(20, Math.max(2, Number(form.requiredInspectorCount) || 2));

  useEffect(() => {
    if (assignmentShape === 'single') {
      setForm((f) => (f.requiredInspectorCount === '1' ? f : { ...f, requiredInspectorCount: '1' }));
    } else {
      setForm((f) => {
        const n = Number(f.requiredInspectorCount);
        if (n >= 2) return f;
        return { ...f, requiredInspectorCount: '2' };
      });
    }
  }, [assignmentShape]);

  useEffect(() => {
    if (!department) return;
    Promise.all([
      api.clients(),
      api.certifications(),
      api.jobTypes({ departmentId: department.id }),
      api.inspectors(),
    ]).then(([c, cert, types, ins]) => {
      setClients(c);
      setCerts(cert);
      setJobTypes(types);
      setInspectors(ins.filter((i) => i.status !== 'Inactive'));
      setForm((f) => ({
        ...f,
        clientId: f.clientId || (c[0] ? String(c[0].id) : ''),
        jobTypeId: types[0] ? String(types[0].id) : '',
        certificationIds: types[0]
          ? types[0].certRequirements.map((r) => r.certification.id)
          : [],
        title: f.title || (types[0]?.name ?? ''),
      }));
    });
  }, [department]);

  useEffect(() => {
    if (assignMode !== 'now') return;
    setTeamSlots((prev) => {
      const defaults = {
        startDate: form.startDate,
        endDate: form.endDate,
      };
      if (prev.length === teamSize) {
        return prev.map((s) => ({
          ...s,
          startDate: s.startDate || defaults.startDate,
          endDate: s.endDate || defaults.endDate,
        }));
      }
      if (prev.length < teamSize) {
        return [
          ...prev,
          ...emptyTeamSlots(teamSize - prev.length, defaults).map((s, i) => ({
            ...s,
            key: `slot-extra-${prev.length + i}-${Date.now()}`,
          })),
        ];
      }
      return prev.slice(0, teamSize);
    });
  }, [assignMode, teamSize, form.startDate, form.endDate]);

  // Prefill Est. hours from job type defaultHours × days × team size (still editable).
  useEffect(() => {
    const type = jobTypes.find((t) => String(t.id) === form.jobTypeId);
    if (!type && !form.startDate && !form.endDate) return;
    const next = suggestEstimatedHours(type, form.startDate, form.endDate, teamSize);
    setForm((f) => (f.estimatedHours === next ? f : { ...f, estimatedHours: next }));
  }, [jobTypes, form.jobTypeId, form.startDate, form.endDate, teamSize]);

  useEffect(() => {
    if (!department) return;
    const clientId = Number(form.clientId);
    const jobTypeId = form.jobTypeId ? Number(form.jobTypeId) : undefined;
    if (!Number.isFinite(clientId) || !form.startDate || !form.endDate) {
      setDuplicates([]);
      setDupAck(false);
      return;
    }

    let cancelled = false;
    const t = window.setTimeout(() => {
      api
        .jobDuplicates({
          clientId,
          departmentId: department.id,
          startDate: form.startDate,
          endDate: form.endDate,
          jobTypeId: jobTypeId && Number.isFinite(jobTypeId) ? jobTypeId : undefined,
          title: !jobTypeId && form.title.trim() ? form.title.trim() : undefined,
        })
        .then((res) => {
          if (cancelled) return;
          setDuplicates(res.items);
          setDupAck(false);
        })
        .catch(() => {
          if (cancelled) return;
          setDuplicates([]);
        });
    }, 350);

    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [department, form.clientId, form.jobTypeId, form.title, form.startDate, form.endDate]);

  const applyJobType = (type: JobType) => {
    setForm((f) => ({
      ...f,
      jobTypeId: String(type.id),
      title: f.title || type.name,
      certificationIds: type.certRequirements.map((r) => r.certification.id),
    }));
    const rate =
      rateBasis === 'hourly'
        ? type.hourRateUsd
        : type.dayRateUsd ?? type.defaultPriceUsd;
    if (rate != null) {
      setTeamSlots((slots) => slots.map((s) => ({ ...s, dayRate: String(rate) })));
    }
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
    if (!department) return;
    setSubmitError('');
    if (duplicates.length > 0 && !dupAck) {
      setSubmitError('Possible duplicates found — confirm “Continue anyway” below, or open the existing job.');
      return;
    }
    if (assignMode === 'now') {
      for (const s of filledTeamSlots(teamSlots)) {
        if (!s.startDate || !s.endDate) {
          setSubmitError('Each selected inspector needs start and end dates.');
          return;
        }
        if (s.endDate < s.startDate) {
          setSubmitError('Inspector end date must be on or after start date.');
          return;
        }
      }
    }
    if (form.requiresQeApproval) {
      const ok = window.confirm(
        'This job will prefer QE-approved inspectors. Non–QE staff can still be assigned with a warning override. Continue?'
      );
      if (!ok) return;
    }
    const slotsPayload =
      assignMode === 'now'
        ? filledTeamSlots(teamSlots).map((s) => ({
            inspectorId: Number(s.inspectorId),
            startDate: s.startDate,
            endDate: s.endDate,
            dayRateUsd: s.dayRate.trim() === '' ? null : Number(s.dayRate),
          }))
        : undefined;

    try {
      const job = await api.createJob({
        ref: form.ref,
        title: form.title,
        jobTypeId: form.jobTypeId ? Number(form.jobTypeId) : undefined,
        clientId: Number(form.clientId),
        departmentId: department.id,
        scope: form.scope,
        location: form.location,
        startDate: form.startDate,
        endDate: form.endDate,
        priority: form.priority,
        estimatedHours: Number(form.estimatedHours),
        requiredInspectorCount: teamSize,
        certificationIds: form.certificationIds,
        requiresQeApproval: form.requiresQeApproval,
        autoCompleteOnEndDate: completionMode === 'auto',
        rateBasis,
        teamSlots: slotsPayload,
      });
      navigate(deptPath(`jobs/${job.id}`));
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Could not create job');
    }
  };

  const selectedType = jobTypes.find((t) => String(t.id) === form.jobTypeId);
  const filledCount = filledTeamSlots(teamSlots).length;
  const hoursPerSlot = Math.max(
    0,
    Math.round((Number(form.estimatedHours) || 0) / Math.max(1, teamSize))
  );

  if (deptLoading || !department) {
    return <p className="text-sm text-slate-500">Loading department…</p>;
  }

  return (
    <div className="max-w-4xl">
      <form onSubmit={submit} className="card p-6 space-y-5">
        <div>
          <h1 className="text-xl font-bold text-navy">New job</h1>
          <p className="text-sm text-slate-500 mt-1">
            Creating in <span className="font-medium text-navy">{department.name}</span>. Set completion,
            team shape, and rate basis before the rest of the form.
          </p>
        </div>

        {/* CM-024 / CM-025 control bar */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 gap-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3"
          aria-label="Job mode"
        >
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Completion
            </div>
            <SegToggle<CompletionMode>
              value={completionMode}
              onChange={(v) => setCompletionMode(v)}
              options={[
                { value: 'auto', label: 'Auto on end date' },
                { value: 'manual', label: 'Manual complete' },
              ]}
            />
            <p className="text-[11px] text-slate-500">
              {completionMode === 'auto'
                ? 'Job closes automatically when the end date passes.'
                : 'Staff or inspector must mark complete.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Assignment
            </div>
            <SegToggle<AssignmentShape>
              value={assignmentShape}
              onChange={(v) => setAssignmentShape(v)}
              options={[
                { value: 'single', label: 'Single' },
                { value: 'team', label: 'Team' },
              ]}
            />
            <p className="text-[11px] text-slate-500">
              {assignmentShape === 'single'
                ? 'One inspector for this job.'
                : 'Multi-PAX team (2–4+). Set headcount below.'}
            </p>
          </div>
          <div className="space-y-1.5">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Rate basis
            </div>
            <SegToggle<RateBasis>
              value={rateBasis}
              onChange={(v) => {
                setRateBasis(v);
                const type = jobTypes.find((t) => String(t.id) === form.jobTypeId);
                if (!type) return;
                const rate =
                  v === 'hourly' ? type.hourRateUsd : type.dayRateUsd ?? type.defaultPriceUsd;
                if (rate != null) {
                  setTeamSlots((slots) => slots.map((s) => ({ ...s, dayRate: String(rate) })));
                }
              }}
              options={[
                { value: 'day', label: 'Day rate' },
                { value: 'hourly', label: 'Hourly' },
              ]}
            />
            <p className="text-[11px] text-slate-500">
              {rateBasis === 'day'
                ? 'Commercial rate charged per calendar day on site.'
                : 'Commercial rate charged per hour worked.'}
            </p>
          </div>
        </div>

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
          {jobTypes.length === 0 && (
            <p className="text-xs text-amber-800 mt-1">
              No job types for this department yet. Add one under Job types.
            </p>
          )}
          {selectedType?.description && (
            <p className="text-xs text-slate-500 mt-1">{selectedType.description}</p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium">Job ref</label>
            <input
              className="input mt-1"
              value={form.ref}
              onChange={(e) => setForm({ ...form, ref: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium">Priority</label>
            <select
              className="input mt-1"
              value={form.priority}
              onChange={(e) => setForm({ ...form, priority: e.target.value })}
            >
              {['Low', 'Normal', 'High', 'Critical'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs font-medium">Title</label>
          <input
            className="input mt-1"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />
        </div>
        <div>
          <label className="text-xs font-medium">Client</label>
          <select
            className="input mt-1"
            value={form.clientId}
            onChange={(e) => setForm({ ...form, clientId: e.target.value })}
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs font-medium">Scope</label>
          <textarea
            className="input mt-1"
            rows={3}
            value={form.scope}
            onChange={(e) => setForm({ ...form, scope: e.target.value })}
          />
        </div>
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
          <div>
            <label className="text-xs font-medium">Job start</label>
            <input
              type="date"
              className="input mt-1"
              value={form.startDate}
              onChange={(e) => setForm({ ...form, startDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium">Job end</label>
            <input
              type="date"
              className="input mt-1"
              value={form.endDate}
              onChange={(e) => setForm({ ...form, endDate: e.target.value })}
              required
            />
          </div>
          <div>
            <label className="text-xs font-medium">Est. hours</label>
            <input
              type="number"
              className="input mt-1"
              value={form.estimatedHours}
              onChange={(e) => setForm({ ...form, estimatedHours: e.target.value })}
            />
            {selectedType && (
              <p className="text-[11px] text-slate-400 mt-1">
                From job type: {hoursPerDay(selectedType)}h
                {form.startDate && form.endDate
                  ? ` × ${Math.max(1, inclusiveDays(form.startDate, form.endDate))} day${
                      inclusiveDays(form.startDate, form.endDate) === 1 ? '' : 's'
                    }`
                  : ''}
                {teamSize > 1 ? ` × ${teamSize} inspectors` : ''} (editable)
              </p>
            )}
          </div>
        </div>

        {assignmentShape === 'team' && (
          <div>
            <label className="text-xs font-medium">Inspectors needed</label>
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {[2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`badge px-3 py-1.5 ${
                    form.requiredInspectorCount === String(n)
                      ? 'bg-teal/20 text-teal'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                  onClick={() => setForm({ ...form, requiredInspectorCount: String(n) })}
                >
                  {n} PAX
                </button>
              ))}
              <input
                type="number"
                min={2}
                max={20}
                className="input w-24"
                value={form.requiredInspectorCount}
                onChange={(e) => setForm({ ...form, requiredInspectorCount: e.target.value })}
                aria-label="Custom inspector count"
              />
            </div>
          </div>
        )}

        <div className="rounded-lg border border-slate-200 p-4 space-y-3">
          <p className="text-xs font-medium text-slate-500">When to assign</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className={`badge px-3 py-1.5 ${
                assignMode === 'later' ? 'bg-teal/20 text-teal' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setAssignMode('later')}
            >
              Assign later
            </button>
            <button
              type="button"
              className={`badge px-3 py-1.5 ${
                assignMode === 'now' ? 'bg-teal/20 text-teal' : 'bg-slate-100 text-slate-600'
              }`}
              onClick={() => setAssignMode('now')}
            >
              Assign now
            </button>
          </div>
          <p className="text-xs text-slate-500">
            {assignMode === 'later'
              ? 'Job opens as Proposed. Assign from the board when ready.'
              : assignmentShape === 'single'
                ? 'Pick one inspector below (blank OK). A filled row makes the job Active.'
                : 'Fill any of the rows below (blanks OK). If at least one inspector is set, the job becomes Active.'}
          </p>
          {assignMode === 'now' && (
            <TeamSlotsEditor
              slots={teamSlots}
              inspectors={inspectors}
              onChange={setTeamSlots}
              rateBasis={rateBasis}
              hoursPerSlot={hoursPerSlot}
              jobTypeRate={
                rateBasis === 'hourly'
                  ? selectedType?.hourRateUsd ?? null
                  : selectedType?.dayRateUsd ?? selectedType?.defaultPriceUsd ?? null
              }
            />
          )}
        </div>

        {duplicates.length > 0 && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 space-y-2">
            <p className="text-sm font-medium text-amber-950">Possible duplicate</p>
            <ul className="space-y-1.5">
              {duplicates.map((d) => (
                <li key={d.id} className="text-sm text-amber-900">
                  <Link
                    to={deptPath(`jobs/${d.id}`)}
                    className="font-medium text-teal underline-offset-2 hover:underline"
                  >
                    {d.ref}
                  </Link>
                  {' — '}
                  {d.title} ({statusLabel(d.status)})
                  <span className="text-amber-800/80">
                    {' '}
                    · {d.startDate.slice(0, 10)} – {d.endDate.slice(0, 10)}
                  </span>
                </li>
              ))}
            </ul>
            <label className="flex items-start gap-2 cursor-pointer pt-1">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={dupAck}
                onChange={(e) => setDupAck(e.target.checked)}
              />
              <span className="text-sm text-amber-950">Continue anyway — create this job as well</span>
            </label>
          </div>
        )}

        <div>
          <label className="text-xs font-medium">Required qualifications</label>
          <p className="text-xs text-slate-400 mb-2">Pre-filled from job type — adjust if needed</p>
          <div className="flex flex-wrap gap-2 mt-2">
            {certs.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => toggleCert(c.id)}
                className={`badge ${
                  form.certificationIds.includes(c.id) ? 'bg-teal/20 text-teal' : 'bg-slate-100 text-slate-600'
                }`}
              >
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
              <span className="text-sm font-medium text-navy">Prefers QE-approved inspector</span>
              <p className="text-xs text-slate-500 mt-0.5">
                QE-approved staff are preferred; non–QE staff can still be assigned with a warning override.
              </p>
            </span>
          </label>
        </div>
        {submitError && <p className="text-sm text-red-600">{submitError}</p>}
        <button
          type="submit"
          className="btn-primary"
          disabled={jobTypes.length === 0 || (duplicates.length > 0 && !dupAck)}
        >
          Create job
        </button>
        <p className="text-xs text-slate-500">
          {assignMode === 'now' && filledCount > 0
            ? `Creates Active with ${filledCount} inspector${filledCount === 1 ? '' : 's'} assigned.`
            : 'Opens as Proposed (New). Use Manage team on the board when ready.'}
        </p>
      </form>
    </div>
  );
}
