import { Link, Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STAFF_ROLES = ['Coordinator', 'Manager', 'Admin'];

export function JobsLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const canManage = STAFF_ROLES.includes(user?.role ?? '');
  const isHub = location.pathname === '/jobs' || location.pathname === '/jobs/';
  const isNew = location.pathname.endsWith('/new');
  const isDetail = /^\/jobs\/\d+/.test(location.pathname);

  if (!canManage && isNew) {
    return <Navigate to="/jobs" replace />;
  }

  return (
    <div className={canManage ? 'max-w-[1600px] mx-auto' : 'max-w-3xl mx-auto'}>
      <div className="mb-6">
        <nav className="text-sm text-slate-500 mb-2">
          <Link to="/" className="hover:text-teal">Home</Link>
          <span className="mx-2">/</span>
          {isDetail || isNew ? (
            <>
              <Link to="/jobs" className="hover:text-teal">Jobs</Link>
              <span className="mx-2">/</span>
              <span className="text-navy font-medium">{isNew ? 'New job' : 'Job detail'}</span>
            </>
          ) : (
            <span className="text-navy font-medium">Jobs</span>
          )}
        </nav>
        {isHub && canManage && (
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-navy">Jobs</h1>
              <p className="text-sm text-slate-500 mt-1">
                Map, board, and list — filter New / Active / Completed to see where work sits
              </p>
            </div>
            <Link to="/jobs/new" className="btn-primary shrink-0">
              + New job
            </Link>
          </div>
        )}
        {isHub && !canManage && (
          <div>
            <h1 className="text-2xl font-bold text-navy">Jobs</h1>
            <p className="text-sm text-slate-500 mt-1">
              Your assignments, completed work, and timesheets
            </p>
          </div>
        )}
      </div>
      <Outlet />
    </div>
  );
}
