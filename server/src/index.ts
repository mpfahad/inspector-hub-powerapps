import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { getJwtSecret } from './config/security.js';
import authRouter from './routes/auth.js';
import jobsRouter from './routes/jobs.js';
import assignmentsRouter from './routes/assignments.js';
import timesheetsRouter from './routes/timesheets.js';
import dashboardRouter from './routes/dashboard.js';
import activityLogsRouter from './routes/activityLogs.js';
import jobTypesRouter from './routes/jobTypes.js';
import leaveRouter from './routes/leave.js';
import notificationsRouter from './routes/notifications.js';
import plannerRouter from './routes/planner.js';
import auditRouter from './routes/audit.js';
import departmentsOverviewRouter from './routes/departments.js';
import competencyRouter from './routes/competency.js';
import reportsRouter from './routes/reports.js';
import mapRouter from './routes/map.js';
import priceChartRouter from './routes/priceChart.js';
import {
  clientsRouter,
  inspectorsRouter,
  departmentsRouter,
  certificationsRouter,
} from './routes/reference.js';
import { promoteAssignedJobsToActive } from './services/jobWorkflow.js';
import { applyProductDefaults } from './services/seedDefaults.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4100);

// Validate secrets before accepting traffic (fails fast in production without JWT_SECRET).
getJwtSecret();

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:5180',
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => res.json({ status: 'ok', service: 'irppms-api' }));

app.use('/api/auth', authRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/assignments', assignmentsRouter);
app.use('/api/timesheets', timesheetsRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/job-types', jobTypesRouter);
app.use('/api/activity-logs', activityLogsRouter);
app.use('/api/leave', leaveRouter);
app.use('/api/notifications', notificationsRouter);
app.use('/api/planner', plannerRouter);
app.use('/api/audit', auditRouter);
app.use('/api/departments', departmentsRouter);
app.use('/api/departments', departmentsOverviewRouter);
app.use('/api/competency', competencyRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/map', mapRouter);
app.use('/api/price-chart', priceChartRouter);
app.use('/api/clients', clientsRouter);
app.use('/api/inspectors', inspectorsRouter);
app.use('/api/certifications', certificationsRouter);

app.listen(PORT, () => {
  console.log(`IRPPMS API listening on http://localhost:${PORT}`);
  promoteAssignedJobsToActive().catch((err) => {
    console.error('Failed to promote assigned jobs to Active', err);
  });
  applyProductDefaults().catch((err) => {
    console.error('Failed to apply startup data defaults', err);
  });
});
