import { Link, Outlet } from 'react-router-dom';
import { DepartmentProvider, useDepartment } from '../../context/DepartmentContext';

function DeptBanner() {
  const { department, loading, deptPath } = useDepartment();
  if (loading) return <p className="text-sm text-slate-500 mb-4">Loading department…</p>;
  if (!department) return <p className="text-sm text-red-600 mb-4">Department not found.</p>;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
      <Link to="/" className="text-slate-500 hover:text-teal">
        Home
      </Link>
      <span className="text-slate-300">/</span>
      <span className="font-semibold text-navy">{department.name}</span>
      <span className="badge bg-slate-100 text-slate-600">{department.code}</span>
      <Link to={deptPath('jobs')} className="text-xs text-teal hover:underline ml-auto">
        Dept home
      </Link>
    </div>
  );
}

export function DeptLayout() {
  return (
    <DepartmentProvider>
      <DeptBanner />
      <Outlet />
    </DepartmentProvider>
  );
}
