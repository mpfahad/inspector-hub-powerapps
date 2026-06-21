import { useMemo } from 'react';
import { ScreenHeader } from '../components/AppShell';
import { BtnPrimary, Gallery, KpiTile, StatusBadge, theme } from '../components/controls';
import { useAppContext } from '../powerplatform/context/AppContext';
import { getList } from '../powerplatform/connector';
import { CountRows, Filter, Sum } from '../powerplatform/operations';
import { seedKpis } from '../powerplatform/seedData';

export function ScrHome() {
  const { navigate } = useAppContext();

  const jobs = getList('Jobs');
  const inspectors = getList('Inspectors');
  const assignments = getList('Assignments');
  const activityLogs = getList('ActivityLogs');
  const leaveRequests = getList('LeaveRequests');

  const kpisLocal = useMemo(() => {
    // PowerFx: CountRows(Filter(Jobs, Status = "In Progress"))
    const activeJobs = CountRows(Filter(jobs, (j) => j.Status === 'In Progress', { delegable: true }));
    const scheduledJobs = CountRows(Filter(jobs, (j) => j.Status === 'Scheduled', { delegable: true }));
    const activeInspectors = CountRows(Filter(inspectors, (i) => i.Status === 'Active', { delegable: true }));
    const pendingLeave = CountRows(Filter(leaveRequests, (l) => l.Status === 'Pending', { delegable: true }));
    const weekProductiveHours = Sum(
      Filter(activityLogs, (a) => a.LogDate >= '2026-06-15'),
      (a) => a.ProductiveHours
    );
    const confirmedAssignments = CountRows(Filter(assignments, (a) => a.Status === 'Confirmed' || a.Status === 'In Progress', { delegable: true }));

    return { activeJobs, scheduledJobs, activeInspectors, pendingLeave, weekProductiveHours, confirmedAssignments };
  }, [jobs, inspectors, assignments, activityLogs, leaveRequests]);

  const kpis = seedKpis;

  const upcomingJobs = useMemo(
    () => Filter(jobs, (j) => j.Status === 'Scheduled' || j.Status === 'In Progress', { delegable: true }).slice(0, 5),
    [jobs]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <ScreenHeader title="Home" />
      <div style={{ padding: theme.spacing.lg, flex: 1 }}>
        <div style={{ display: 'flex', gap: theme.spacing.md, flexWrap: 'wrap', marginBottom: theme.spacing.lg }}>
          <KpiTile label="Jobs In Progress" value={kpisLocal.activeJobs} />
          <KpiTile label="Scheduled Jobs" value={kpisLocal.scheduledJobs} />
          <KpiTile label="Active Inspectors" value={kpisLocal.activeInspectors} />
          <KpiTile label="Avg Utilization" value={`${kpis.utilization}%`} sub="From Lovable KPIs" />
          <KpiTile label="Acceptance Rate" value={`${kpis.acceptanceRate}%`} />
          <KpiTile label="Pending Leave" value={kpisLocal.pendingLeave} />
        </div>

        <div style={{ display: 'flex', gap: theme.spacing.md, marginBottom: theme.spacing.lg }}>
          <BtnPrimary onClick={() => navigate('scrJobs')}>View Jobs</BtnPrimary>
          <BtnPrimary onClick={() => navigate('scrPlanner')}>Open Planner</BtnPrimary>
          <BtnPrimary onClick={() => navigate('scrActivityLog')}>Log Activity</BtnPrimary>
        </div>

        <h2 style={{ fontSize: 16, marginBottom: theme.spacing.sm }}>Upcoming & Active Jobs</h2>
        <Gallery
          items={upcomingJobs}
          template={(job) => (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <strong>{job.Title}</strong>
                <div style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 4 }}>
                  {job.StartDate} → {job.EndDate}
                </div>
              </div>
              <StatusBadge status={job.Status} />
            </div>
          )}
        />
      </div>
    </div>
  );
}
