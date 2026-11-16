import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api, type Department } from '../../lib/api';
import { rememberDeptCode } from '../../context/DepartmentContext';
import { NotificationBell } from './NotificationBell';

const deptChildLinks = [
  { suffix: 'jobs', label: 'Jobs' },
  { suffix: 'inspectors', label: 'Inspectors' },
  { suffix: 'job-types', label: 'Job types' },
  { suffix: 'planner', label: 'Planner' },
  { suffix: 'competency', label: 'Competency' },
  { suffix: 'leave', label: 'Leave' },
  { suffix: 'reports', label: 'Reports' },
] as const;

const inspectorNav = [
  { to: '/', label: 'Dashboard' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/leave', label: 'Leave' },
];

/** Seed placeholder — not a real operating department. */
function isPlaceholderDept(d: Department) {
  const code = d.code.toUpperCase();
  return code === 'HOLD' || d.name.trim().toLowerCase() === 'unassigned';
}

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  const isStaff = user?.role !== 'Inspector';

  const visibleDepartments = useMemo(() => {
    const allowed = user?.departmentIds ?? [];
    return departments.filter((d) => {
      if (isPlaceholderDept(d)) return false;
      if (allowed.length === 0) return true;
      return allowed.includes(d.id);
    });
  }, [departments, user?.departmentIds]);

  useEffect(() => {
    if (user?.role !== 'Inspector') return;
    api
      .myAssignments()
      .then(({ pending, pendingQe }) => setPendingCount((pending?.length ?? 0) + (pendingQe?.length ?? 0)))
      .catch(() => setPendingCount(0));
  }, [user?.role]);

  useEffect(() => {
    if (!isStaff) return;
    api.departments().then(setDepartments).catch(() => setDepartments([]));
  }, [isStaff]);

  const activeDeptCode = useMemo(() => {
    const m = location.pathname.match(/^\/d\/([^/]+)/i);
    return m?.[1]?.toUpperCase() ?? null;
  }, [location.pathname]);

  /** Only the selected department appears in the sidebar (picked from home cards). */
  const activeDepartment = useMemo(() => {
    if (!activeDeptCode) return null;
    return (
      visibleDepartments.find((d) => d.code.toUpperCase() === activeDeptCode) ?? null
    );
  }, [activeDeptCode, visibleDepartments]);

  useEffect(() => {
    if (activeDepartment) rememberDeptCode(activeDepartment.code);
  }, [activeDepartment]);

  const handleSignOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-slate-200 bg-white p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-lg font-bold text-navy">Inspection Hub</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Resource planning</div>
          <div className="mt-2 text-xs text-slate-600">{user?.fullName}</div>
          <div className="text-xs text-teal font-medium">{user?.role}</div>
        </div>

        <NotificationBell />

        <nav className="flex flex-col gap-0.5 flex-1 overflow-y-auto mt-2">
          {!isStaff &&
            inspectorNav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm flex items-center justify-between ${
                    isActive ? 'bg-teal/10 text-navy font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                <span>{item.label}</span>
                {item.to === '/jobs' && pendingCount > 0 && (
                  <span className="badge bg-amber-100 text-amber-800">{pendingCount}</span>
                )}
              </NavLink>
            ))}

          {isStaff && (
            <>
              <NavLink
                to="/"
                end
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${
                    isActive ? 'bg-teal/10 text-navy font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                Departments
              </NavLink>

              {activeDepartment ? (
                <div className="mt-3">
                  <div className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                    Working in
                  </div>
                  <div className="rounded-lg bg-navy text-white px-3 py-2.5 text-sm font-medium truncate mb-1">
                    {activeDepartment.name}
                  </div>
                  <div className="ml-1 flex flex-col gap-0.5 border-l border-slate-200 pl-2">
                    {deptChildLinks.map((child) => (
                      <NavLink
                        key={child.suffix}
                        to={`/d/${activeDepartment.code}/${child.suffix}`}
                        className={({ isActive }) =>
                          `rounded-md px-2.5 py-1.5 text-xs ${
                            isActive
                              ? 'bg-teal/10 text-navy font-medium'
                              : 'text-slate-500 hover:bg-slate-50 hover:text-navy'
                          }`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="mt-2 w-full text-left rounded-lg px-3 py-2 text-xs text-teal hover:bg-teal/5"
                    onClick={() => navigate('/')}
                  >
                    ← All departments
                  </button>
                </div>
              ) : (
                <p className="mt-3 px-3 text-xs text-slate-400">
                  Pick a department on the home cards to open its workspace.
                </p>
              )}

              <div className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Shared
              </div>
              <NavLink
                to="/clients"
                className={({ isActive }) =>
                  `rounded-lg px-3 py-2 text-sm ${
                    isActive ? 'bg-teal/10 text-navy font-medium' : 'text-slate-600 hover:bg-slate-50'
                  }`
                }
              >
                Clients
              </NavLink>
            </>
          )}
        </nav>

        <div className="mt-4 pt-4 border-t border-slate-200 space-y-1">
          {isStaff && (
            <NavLink
              to="/settings"
              className={({ isActive }) =>
                `rounded-lg px-3 py-2 text-sm block ${
                  isActive ? 'bg-teal/10 text-navy font-medium' : 'text-slate-600 hover:bg-slate-50'
                }`
              }
            >
              Settings
            </NavLink>
          )}
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-navy hover:bg-slate-100 disabled:opacity-60"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
}
