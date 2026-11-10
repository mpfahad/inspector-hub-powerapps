import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Department } from '../lib/api';

type DepartmentContextValue = {
  departments: Department[];
  department: Department | null;
  deptCode: string | null;
  loading: boolean;
  deptPath: (suffix?: string) => string;
};

const DepartmentContext = createContext<DepartmentContextValue | null>(null);

const STORAGE_KEY = 'irppms_last_dept_code';

export function rememberDeptCode(code: string) {
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {
    /* ignore */
  }
}

export function lastDeptCode(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function DepartmentProvider({ children }: { children: ReactNode }) {
  const { deptCode: rawCode } = useParams();
  const deptCode = rawCode?.trim().toUpperCase() || null;
  const navigate = useNavigate();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .departments()
      .then(setDepartments)
      .catch(() => setDepartments([]))
      .finally(() => setLoading(false));
  }, []);

  const department = useMemo(() => {
    if (!deptCode) return null;
    return (
      departments.find((d) => d.code.toUpperCase() === deptCode) ??
      departments.find((d) => d.name.toLowerCase() === deptCode.toLowerCase()) ??
      null
    );
  }, [departments, deptCode]);

  useEffect(() => {
    if (!deptCode || loading || departments.length === 0) return;
    if (!department) {
      navigate('/', { replace: true });
      return;
    }
    rememberDeptCode(department.code);
  }, [deptCode, department, departments, loading, navigate]);

  const value = useMemo<DepartmentContextValue>(
    () => ({
      departments,
      department,
      deptCode: department?.code ?? deptCode,
      loading,
      deptPath: (suffix = '') => {
        const code = department?.code ?? deptCode ?? 'HOLD';
        const clean = suffix.replace(/^\//, '');
        return clean ? `/d/${code}/${clean}` : `/d/${code}`;
      },
    }),
    [departments, department, deptCode, loading]
  );

  return <DepartmentContext.Provider value={value}>{children}</DepartmentContext.Provider>;
}

export function useDepartment() {
  const ctx = useContext(DepartmentContext);
  if (!ctx) throw new Error('useDepartment requires DepartmentProvider');
  return ctx;
}

/** Optional hook for pages that may sit outside a department route. */
export function useOptionalDepartment() {
  return useContext(DepartmentContext);
}
