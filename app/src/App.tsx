import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { StaffRoute } from './components/auth/StaffRoute';
import { JobsLayout } from './components/jobs/JobsLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { JobNewPage } from './pages/JobNewPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobTypesPage } from './pages/JobTypesPage';
import { ClientsPage, InspectorsPage } from './pages/ReferencePages';
import { InspectorDetailPage } from './pages/InspectorDetailPage';
import { LeavePage } from './pages/LeavePage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { CompetencyPage } from './pages/CompetencyPage';
import { PlannerPage } from './pages/PlannerPage';
import { ReportsPage } from './pages/ReportsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function StaffOnly({ children }: { children: React.ReactNode }) {
  return (
    <StaffRoute>
      {children}
    </StaffRoute>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route element={<PrivateRoute><AppShell /></PrivateRoute>}>
            <Route index element={<DashboardPage />} />
            <Route path="jobs" element={<JobsLayout />}>
              <Route index element={<JobsPage />} />
              <Route
                path="new"
                element={
                  <StaffOnly>
                    <JobNewPage />
                  </StaffOnly>
                }
              />
              <Route path=":id" element={<JobDetailPage />} />
            </Route>
            <Route path="pipeline" element={<Navigate to="/jobs" replace />} />
            <Route path="assignments" element={<Navigate to="/jobs" replace />} />
            <Route path="job-types" element={<StaffOnly><JobTypesPage /></StaffOnly>} />
            <Route path="timesheets" element={<Navigate to="/jobs#timesheet" replace />} />
            <Route path="planner" element={<StaffOnly><PlannerPage /></StaffOnly>} />
            <Route path="departments" element={<StaffOnly><DepartmentsPage /></StaffOnly>} />
            <Route path="competency" element={<StaffOnly><CompetencyPage /></StaffOnly>} />
            <Route path="reports" element={<StaffOnly><ReportsPage /></StaffOnly>} />
            <Route path="map" element={<Navigate to="/jobs#map" replace />} />
            <Route path="leave" element={<LeavePage />} />
            <Route path="inspectors" element={<StaffOnly><InspectorsPage /></StaffOnly>} />
            <Route path="inspectors/:id" element={<StaffOnly><InspectorDetailPage /></StaffOnly>} />
            <Route path="clients" element={<StaffOnly><ClientsPage /></StaffOnly>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
