import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const STAFF_ROLES = ['Coordinator', 'Manager', 'Admin'];

export function StaffRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!STAFF_ROLES.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function isStaffRole(role: string) {
  return STAFF_ROLES.includes(role);
}
