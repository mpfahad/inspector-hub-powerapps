import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { lastDeptCode } from './context/DepartmentContext';
import { AppShell } from './components/layout/AppShell';
import { DeptLayout } from './components/layout/DeptLayout';
import { StaffRoute } from './components/auth/StaffRoute';
import { JobsLayout } from './components/jobs/JobsLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage, DepartmentDashboardPage } from './pages/DashboardPage';
import { JobsPage } from './pages/JobsPage';
import { JobNewPage } from './pages/JobNewPage';
import { JobDetailPage } from './pages/JobDetailPage';
import { JobTypesPage } from './pages/JobTypesPage';
import { ClientsPage, InspectorsPage } from './pages/ReferencePages';
import { InspectorDetailPage } from './pages/InspectorDetailPage';
import { LeavePage } from './pages/LeavePage';
import { CompetencyPage } from './pages/CompetencyPage';
import { PlannerPage } from './pages/PlannerPage';
import { ReportsPage } from './pages/ReportsPage';
import { MapPopoutPage } from './pages/MapPopoutPage';
import { SettingsPage } from './pages/SettingsPage';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-8">Loading…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function StaffOnly({ children }: { children: React.ReactNode }) {
  return <StaffRoute>{children}</StaffRoute>;
}

/** Redirect legacy global staff URLs into the last (or default) department. */
function LegacyDeptRedirect({ suffix }: { suffix: string }) {
  const code = lastDeptCode() || 'LIFT';
  return <Navigate to={`/d/${code}/${suffix}`} replace />;
}

function DeptJobsRoutes() {
  return <JobsLayout />;
}

function InspectorDetailRedirect() {
  const { id } = useParams();
  const code = lastDeptCode() || 'LIFT';
  return <Navigate to={`/d/${code}/inspectors/${id}`} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          {/* Map pop-out: auth only, no AppShell chrome */}
          <Route
            path="/map/popout"
            element={
              <PrivateRoute>
                <StaffOnly>
                  <MapPopoutPage />
                </StaffOnly>
              </PrivateRoute>
            }
          />
          <Route
            element={
              <PrivateRoute>
                <AppShell />
              </PrivateRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="settings" element={<StaffOnly><SettingsPage /></StaffOnly>} />
            <Route path="clients" element={<StaffOnly><ClientsPage /></StaffOnly>} />

            {/* Legacy redirects → department-scoped */}
            <Route path="pipeline" element={<Navigate to="/jobs" replace />} />
            <Route path="assignments" element={<Navigate to="/jobs" replace />} />
            <Route path="map" element={<Navigate to="/jobs#map" replace />} />
            <Route path="timesheets" element={<Navigate to="/jobs#timesheet" replace />} />
            <Route path="departments" element={<LegacyDeptRedirect suffix="jobs" />} />
            <Route path="job-types" element={<LegacyDeptRedirect suffix="job-types" />} />
            <Route path="planner" element={<LegacyDeptRedirect suffix="planner" />} />
            <Route path="competency" element={<LegacyDeptRedirect suffix="competency" />} />
            <Route path="reports" element={<LegacyDeptRedirect suffix="reports" />} />
            <Route path="leave" element={<LeavePage />} />
            <Route path="inspectors" element={<LegacyDeptRedirect suffix="inspectors" />} />
            <Route path="inspectors/:id" element={<InspectorDetailRedirect />} />

            {/* Inspector global jobs (unchanged). Staff /new redirects into last dept. */}
            <Route path="jobs" element={<JobsLayout />}>
              <Route index element={<JobsPage />} />
              <Route path="new" element={<LegacyDeptRedirect suffix="jobs/new" />} />
              <Route path=":id" element={<JobDetailPage />} />
            </Route>

            {/* Department-scoped staff workspace */}
            <Route
              path="d/:deptCode"
              element={
                <StaffOnly>
                  <DeptLayout />
                </StaffOnly>
              }
            >
              <Route index element={<DepartmentDashboardPage />} />
              <Route path="dashboard" element={<DepartmentDashboardPage />} />
              <Route path="jobs" element={<DeptJobsRoutes />}>
                <Route index element={<JobsPage />} />
                <Route path="new" element={<JobNewPage />} />
                <Route path=":id" element={<JobDetailPage />} />
              </Route>
              <Route path="inspectors" element={<InspectorsPage />} />
              <Route path="inspectors/:id" element={<InspectorDetailPage />} />
              <Route path="job-types" element={<JobTypesPage />} />
              <Route path="planner" element={<PlannerPage />} />
              <Route path="competency" element={<CompetencyPage />} />
              <Route path="leave" element={<LeavePage />} />
              <Route path="reports" element={<ReportsPage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
