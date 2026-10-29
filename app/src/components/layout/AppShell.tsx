import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../lib/api';
import { NotificationBell } from './NotificationBell';

const coordinatorNav = [
  { to: '/', label: 'Dashboard' },
  { to: '/planner', label: 'Planner' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/departments', label: 'Departments' },
  { to: '/competency', label: 'Competency' },
  { to: '/reports', label: 'Reports' },
  { to: '/leave', label: 'Leave' },
  { to: '/job-types', label: 'Job Types' },
  { to: '/inspectors', label: 'Inspectors' },
  { to: '/clients', label: 'Clients' },
];

const inspectorNav = [
  { to: '/', label: 'Dashboard' },
  { to: '/jobs', label: 'Jobs' },
  { to: '/leave', label: 'Leave' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);
  const [signingOut, setSigningOut] = useState(false);

  const nav = user?.role === 'Inspector' ? inspectorNav : coordinatorNav;

  useEffect(() => {
    if (user?.role !== 'Inspector') return;
    api
      .myAssignments()
      .then(({ pending, pendingQe }) => setPendingCount((pending?.length ?? 0) + (pendingQe?.length ?? 0)))
      .catch(() => setPendingCount(0));
  }, [user?.role]);

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
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white p-4 flex flex-col">
        <div className="mb-6">
          <div className="text-lg font-bold text-navy">IRPPMS</div>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">Inspector Platform</div>
          <div className="mt-2 text-xs text-slate-600">{user?.fullName}</div>
          <div className="text-xs text-teal font-medium">{user?.role}</div>
        </div>

        <NotificationBell />

        <nav className="flex flex-col gap-1 flex-1 overflow-y-auto">
          {nav.map((item) => (
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
              {item.to === '/jobs' && user?.role === 'Inspector' && pendingCount > 0 && (
                <span className="badge bg-amber-100 text-amber-800">{pendingCount}</span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 pt-4 border-t border-slate-200">
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
