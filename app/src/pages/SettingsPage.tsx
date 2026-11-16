import { useEffect, useMemo, useState } from 'react';
import { api, type AppUserAccount, type Department } from '../lib/api';
import { useAuth } from '../context/AuthContext';

const ROLES = ['Admin', 'Manager', 'Coordinator', 'Inspector'] as const;

function randomTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 12; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows
    .map((r) =>
      r
        .map((cell) => {
          const s = String(cell ?? '');
          return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(',')
    )
    .join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function parseImportText(text: string): {
  email: string;
  fullName: string;
  role: string;
  departmentCodes?: string[];
}[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length === 0) return [];

  const first = lines[0].toLowerCase();
  const hasHeader = first.includes('email') && (first.includes('name') || first.includes('fullname'));
  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    const parts = line.includes('\t') ? line.split('\t') : line.split(',').map((p) => p.trim());
    const email = (parts[0] ?? '').trim();
    const fullName = (parts[1] ?? email.split('@')[0] ?? 'User').trim();
    const roleRaw = (parts[2] ?? 'Coordinator').trim();
    const role = ROLES.find((r) => r.toLowerCase() === roleRaw.toLowerCase()) ?? 'Coordinator';
    const deptPart = (parts[3] ?? '').trim();
    const departmentCodes = deptPart
      ? deptPart.split(/[|;]/).map((c) => c.trim()).filter(Boolean)
      : undefined;
    return { email, fullName, role, departmentCodes };
  });
}

type FormState = {
  fullName: string;
  email: string;
  role: string;
  password: string;
  allDepartments: boolean;
  departmentIds: number[];
};

const emptyForm = (): FormState => ({
  fullName: '',
  email: '',
  role: 'Coordinator',
  password: '',
  allDepartments: true,
  departmentIds: [],
});

export function SettingsPage() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'Admin';
  const [users, setUsers] = useState<AppUserAccount[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [passwordExport, setPasswordExport] = useState<
    { email: string; fullName: string; role: string; temporaryPassword: string; action?: string }[]
  >([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkText, setBulkText] = useState('');
  const [showBulk, setShowBulk] = useState(false);
  const [resetExisting, setResetExisting] = useState(false);

  const load = () => {
    if (!isAdmin) return;
    Promise.all([api.users(), api.departments()])
      .then(([u, d]) => {
        setUsers(u);
        setDepartments(d.filter((x) => x.code.toUpperCase() !== 'HOLD'));
        setError('');
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load users'));
  };

  useEffect(() => {
    load();
  }, [isAdmin]);

  const allSelected = useMemo(
    () => users.length > 0 && users.every((u) => selected.has(u.id)),
    [users, selected]
  );

  if (!isAdmin) {
    return (
      <div className="max-w-xl space-y-3">
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-slate-500">
          User and department access is managed by Admin. Ask an administrator if you need access to another
          department.
        </p>
      </div>
    );
  }

  const toggleDept = (id: number) => {
    setForm((f) => ({
      ...f,
      departmentIds: f.departmentIds.includes(id)
        ? f.departmentIds.filter((x) => x !== id)
        : [...f.departmentIds, id],
    }));
  };

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm(), password: randomTempPassword() });
    setShowForm(true);
    setShowBulk(false);
  };

  const openEdit = (u: AppUserAccount) => {
    setEditingId(u.id);
    setForm({
      fullName: u.fullName,
      email: u.email,
      role: u.role,
      password: '',
      allDepartments: u.allDepartments,
      departmentIds: u.departments.map((d) => d.id),
    });
    setShowForm(true);
    setShowBulk(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (editingId) {
        const updated = await api.updateUser(editingId, {
          fullName: form.fullName.trim(),
          role: form.role,
          departmentIds: form.allDepartments ? [] : form.departmentIds,
          ...(form.password.trim() ? { password: form.password.trim() } : {}),
        });
        if (updated.temporaryPassword) {
          setPasswordExport([
            {
              email: updated.email,
              fullName: updated.fullName,
              role: updated.role,
              temporaryPassword: updated.temporaryPassword,
              action: 'password_reset',
            },
          ]);
        }
      } else {
        const password = form.password.trim() || randomTempPassword();
        const created = await api.createUser({
          email: form.email.trim(),
          fullName: form.fullName.trim(),
          role: form.role,
          password,
          departmentIds: form.allDepartments ? [] : form.departmentIds,
        });
        setPasswordExport([
          {
            email: created.email,
            fullName: created.fullName,
            role: created.role,
            temporaryPassword: created.temporaryPassword ?? password,
            action: 'created',
          },
        ]);
      }
      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save user');
    } finally {
      setSaving(false);
    }
  };

  const runBulkImport = async () => {
    const rows = parseImportText(bulkText);
    if (rows.length === 0) {
      setError('Paste CSV or TSV rows: email, fullName, role, departmentCodes');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await api.bulkImportUsers({
        users: rows,
        resetExistingPasswords: resetExisting,
      });
      const withPwd = res.items.filter((i) => i.temporaryPassword);
      setPasswordExport(
        withPwd.map((i) => ({
          email: i.email,
          fullName: i.fullName,
          role: i.role,
          temporaryPassword: i.temporaryPassword,
          action: i.action,
        }))
      );
      if (res.errors.length) {
        setError(res.errors.map((e) => `${e.email}: ${e.error}`).join('; '));
      }
      setShowBulk(false);
      setBulkText('');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bulk import failed');
    } finally {
      setSaving(false);
    }
  };

  const resetSelectedPasswords = async () => {
    const ids = [...selected];
    if (ids.length === 0) {
      setError('Select one or more users first.');
      return;
    }
    if (!window.confirm(`Generate new random passwords for ${ids.length} user(s)?`)) return;
    setSaving(true);
    setError('');
    try {
      const res = await api.resetUserPasswords(ids);
      setPasswordExport(
        res.items.map((i) => ({
          email: i.email,
          fullName: i.fullName,
          role: i.role,
          temporaryPassword: i.temporaryPassword,
          action: 'password_reset',
        }))
      );
      setSelected(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not reset passwords');
    } finally {
      setSaving(false);
    }
  };

  const exportPasswords = () => {
    if (passwordExport.length === 0) return;
    downloadCsv('inspection-hub-temp-passwords.csv', [
      ['email', 'fullName', 'role', 'temporaryPassword', 'action'],
      ...passwordExport.map((r) => [
        r.email,
        r.fullName,
        r.role,
        r.temporaryPassword,
        r.action ?? '',
      ]),
    ]);
  };

  const downloadTemplate = () => {
    downloadCsv('users-import-template.csv', [
      ['email', 'fullName', 'role', 'departmentCodes'],
      ['coordinator@example.com', 'Alex Coordinator', 'Coordinator', 'LIFT'],
      ['manager@example.com', 'Sam Manager', 'Manager', 'LIFT|RIGS'],
      ['admin2@example.com', 'Pat Admin', 'Admin', ''],
    ]);
  };

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-navy">Settings</h1>
        <p className="text-sm text-slate-500 mt-1">
          Add users, assign roles and departments, bulk-import, and export temporary passwords.
        </p>
      </div>

      {passwordExport.length > 0 && (
        <div className="rounded-lg border border-teal/30 bg-teal/5 px-4 py-3 text-sm space-y-2">
          <p className="font-medium text-navy">
            Temporary passwords ready — copy or export now (not stored in plain text after this).
          </p>
          <div className="overflow-x-auto max-h-48">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pr-3 py-1">Email</th>
                  <th className="pr-3 py-1">Password</th>
                  <th className="py-1">Action</th>
                </tr>
              </thead>
              <tbody>
                {passwordExport.map((r) => (
                  <tr key={r.email} className="border-t border-teal/10">
                    <td className="pr-3 py-1 font-mono">{r.email}</td>
                    <td className="pr-3 py-1 font-mono font-semibold text-navy">{r.temporaryPassword}</td>
                    <td className="py-1 text-slate-500">{r.action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary text-xs" onClick={exportPasswords}>
              Export CSV
            </button>
            <button type="button" className="btn-secondary text-xs" onClick={() => setPasswordExport([])}>
              Dismiss
            </button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100">
          <div>
            <h2 className="font-semibold text-navy">Users & access</h2>
            <p className="text-xs text-slate-500">Empty department list = all departments</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={downloadTemplate}>
              CSV template
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              onClick={() => {
                setShowBulk(true);
                setShowForm(false);
              }}
            >
              Bulk import
            </button>
            <button
              type="button"
              className="btn-secondary text-sm"
              disabled={saving || selected.size === 0}
              onClick={resetSelectedPasswords}
            >
              Reset passwords ({selected.size})
            </button>
            <button type="button" className="btn-primary text-sm" onClick={openCreate}>
              Add user
            </button>
          </div>
        </div>

        {showBulk && (
          <div className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-navy">Bulk import</h3>
            <p className="text-xs text-slate-500">
              One row per user: <span className="font-mono">email, fullName, role, departmentCodes</span>.
              Dept codes like <span className="font-mono">LIFT|RIGS</span>; leave blank for all departments.
              Random passwords are generated and shown once for export.
            </p>
            <textarea
              className="input font-mono text-xs min-h-[140px]"
              placeholder={'email,fullName,role,departmentCodes\nuser@applus.com,Jane Doe,Coordinator,LIFT'}
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={resetExisting}
                onChange={(e) => setResetExisting(e.target.checked)}
              />
              Reset password for existing emails (otherwise skip)
            </label>
            <div className="flex gap-2">
              <button type="button" className="btn-primary text-sm" disabled={saving} onClick={runBulkImport}>
                {saving ? 'Importing…' : 'Import & generate passwords'}
              </button>
              <button type="button" className="btn-secondary text-sm" onClick={() => setShowBulk(false)}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {showForm && (
          <form onSubmit={submit} className="p-4 border-b border-slate-100 space-y-3 bg-slate-50/50">
            <h3 className="text-sm font-semibold text-navy">{editingId ? 'Edit user' : 'Add user'}</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Full name</label>
                <input
                  className="input mt-1"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Email</label>
                <input
                  className="input mt-1"
                  type="email"
                  required
                  disabled={Boolean(editingId)}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Role</label>
                <select
                  className="input mt-1"
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value })}
                >
                  {ROLES.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500">
                  {editingId ? 'New password (optional)' : 'Temp password'}
                </label>
                <div className="flex gap-2 mt-1">
                  <input
                    className="input font-mono"
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder={editingId ? 'Leave blank to keep' : ''}
                  />
                  <button
                    type="button"
                    className="btn-secondary text-xs shrink-0"
                    onClick={() => setForm({ ...form, password: randomTempPassword() })}
                  >
                    Random
                  </button>
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.allDepartments}
                onChange={(e) => setForm({ ...form, allDepartments: e.target.checked })}
              />
              All departments
            </label>
            {!form.allDepartments && (
              <div className="flex flex-wrap gap-2">
                {departments.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    className={`badge px-3 py-1.5 ${
                      form.departmentIds.includes(d.id)
                        ? 'bg-teal/20 text-teal'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                    onClick={() => toggleDept(d.id)}
                  >
                    {d.name}
                  </button>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button type="submit" className="btn-primary text-sm" disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save changes' : 'Create user'}
              </button>
              <button
                type="button"
                className="btn-secondary text-sm"
                onClick={() => {
                  setShowForm(false);
                  setEditingId(null);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase text-slate-500 border-b border-slate-100">
              <tr>
                <th className="p-3 w-10">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => {
                      if (e.target.checked) setSelected(new Set(users.map((u) => u.id)));
                      else setSelected(new Set());
                    }}
                    aria-label="Select all users"
                  />
                </th>
                <th className="p-3">Name / email</th>
                <th className="p-3">Role</th>
                <th className="p-3">Departments</th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-slate-50">
                  <td className="p-3">
                    <input
                      type="checkbox"
                      checked={selected.has(u.id)}
                      onChange={(e) => {
                        setSelected((prev) => {
                          const next = new Set(prev);
                          if (e.target.checked) next.add(u.id);
                          else next.delete(u.id);
                          return next;
                        });
                      }}
                      aria-label={`Select ${u.email}`}
                    />
                  </td>
                  <td className="p-3">
                    <div className="font-medium text-navy">{u.fullName}</div>
                    <div className="text-xs text-slate-500">{u.email}</div>
                  </td>
                  <td className="p-3">
                    <span className="badge bg-slate-100">{u.role}</span>
                  </td>
                  <td className="p-3 text-slate-600">
                    {u.allDepartments ? 'All' : u.departments.map((d) => d.name).join(', ') || '—'}
                  </td>
                  <td className="p-3 text-right">
                    <button type="button" className="text-xs text-teal hover:underline" onClick={() => openEdit(u)}>
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
