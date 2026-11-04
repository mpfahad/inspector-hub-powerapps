const API = import.meta.env.VITE_API_URL ?? '';
import type { JobTiming } from './jobProgress';
import type { JobCertSummary } from './certs';

let onUnauthorized: (() => void) | null = null;

export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export const API_OFFLINE_MESSAGE =
  'Cannot reach the IRPPMS API on port 4100. Start it with `npm run dev` from the project root, or run `npm run dev` in the `server` folder (keep it running in a separate terminal).';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...options,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
    });
  } catch {
    throw new Error(API_OFFLINE_MESSAGE);
  }

  if (!res.ok) {
    if (res.status === 401) {
      onUnauthorized?.();
    }
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error ?? res.statusText ?? 'Request failed';
    if (res.status >= 500 && /proxy|ECONNREFUSED|socket hang up/i.test(message)) {
      throw new Error(API_OFFLINE_MESSAGE);
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function checkApiHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${API}/api/health`, { credentials: 'include' });
    return res.ok;
  } catch {
    return false;
  }
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: User }>('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout: () => request('/api/auth/logout', { method: 'POST' }),
  me: () => request<{ user: User }>('/api/auth/me'),
  kpis: () =>
    request<{ openJobs: number; activeInspectors: number; activeJobs: number }>(
      '/api/dashboard/kpis'
    ),
  operationsDashboard: () => request<OperationsDashboardData>('/api/dashboard/operations'),
  departmentsOverview: () => request<DepartmentOverview[]>('/api/departments/overview'),
  competency: () => request<CompetencyData>('/api/competency'),
  inspectorDashboard: () =>
    request<{
      counts: { activeJobs: number; completedJobs: number };
      activeJobs: Assignment[];
      recentCompleted: Assignment[];
    }>('/api/dashboard/inspector'),
  jobsBoard: () => request<JobsBoardResponse>('/api/jobs/pipeline'),
  pipeline: () => request<JobsBoardResponse>('/api/jobs/pipeline'),
  jobs: () => request<Job[]>('/api/jobs'),
  job: (id: number) => request<JobDetail>(`/api/jobs/${id}`),
  createJob: (data: CreateJobPayload) => request<JobDetail>('/api/jobs', { method: 'POST', body: JSON.stringify(data) }),
  submitJob: (id: number) => request(`/api/jobs/${id}/submit`, { method: 'POST' }),
  rerunJobAssessment: (id: number) => request(`/api/jobs/${id}/rerun-assessment`, { method: 'POST' }),
  assignJob: (id: number, inspectorId: number, role?: string, agreedPriceUsd?: number | null) =>
    request(`/api/jobs/${id}/assign`, {
      method: 'POST',
      body: JSON.stringify({ inspectorId, role, agreedPriceUsd }),
    }),
  completeJob: (id: number, inspectorId: number, comments: string, agreedPriceUsd?: number | null) =>
    request<JobDetail>(`/api/jobs/${id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ inspectorId, comments, agreedPriceUsd }),
    }),
  updateJobPrice: (id: number, agreedPriceUsd: number) =>
    request<JobDetail>(`/api/jobs/${id}/price`, { method: 'PUT', body: JSON.stringify({ agreedPriceUsd }) }),
  jobTypes: () => request<JobType[]>('/api/job-types'),
  jobTypesAll: () => request<JobType[]>('/api/job-types/all'),
  createJobType: (data: JobTypePayload) =>
    request<JobType>('/api/job-types', { method: 'POST', body: JSON.stringify(data) }),
  updateJobType: (id: number, data: Partial<JobTypePayload> & { active?: boolean }) =>
    request<JobType>(`/api/job-types/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  myAssignments: () =>
    request<{ pending: Assignment[]; pendingQe: Assignment[]; active: Assignment[]; completed: Assignment[] }>(
      '/api/assignments/mine'
    ),
  timesheets: () => request<Timesheet[]>('/api/timesheets'),
  timesheet: (id: number) => request<TimesheetDetail>(`/api/timesheets/${id}`),
  timesheetDefaults: () => request<{ periodStart: string; periodEnd: string }>('/api/timesheets/defaults'),
  previewTimesheet: (params: { inspectorId?: number; periodStart: string; periodEnd: string }) => {
    const q = new URLSearchParams();
    if (params.inspectorId) q.set('inspectorId', String(params.inspectorId));
    q.set('periodStart', params.periodStart);
    q.set('periodEnd', params.periodEnd);
    return request<TimesheetPreview>(`/api/timesheets/preview?${q}`);
  },
  generateTimesheet: (data: { inspectorId?: number; periodStart: string; periodEnd: string }) =>
    request<Timesheet>('/api/timesheets/generate', { method: 'POST', body: JSON.stringify(data) }),
  timesheetReportPdfUrl: (params: { inspectorId?: number; periodStart: string; periodEnd: string }) => {
    const q = new URLSearchParams();
    if (params.inspectorId) q.set('inspectorId', String(params.inspectorId));
    q.set('periodStart', params.periodStart);
    q.set('periodEnd', params.periodEnd);
    return `${API}/api/timesheets/report.pdf?${q}`;
  },
  timesheetPdfUrl: (id: number) => `${API}/api/timesheets/${id}/pdf`,
  clients: () => request<Client[]>('/api/clients'),
  createClient: (data: {
    name: string;
    industry?: string | null;
    location?: string | null;
    latitude?: number | null;
    longitude?: number | null;
    contact?: string | null;
    email?: string | null;
  }) => request<Client>('/api/clients', { method: 'POST', body: JSON.stringify(data) }),
  updateClient: (
    id: number,
    data: {
      name?: string;
      industry?: string | null;
      location?: string | null;
      latitude?: number | null;
      longitude?: number | null;
      contact?: string | null;
      email?: string | null;
    }
  ) => request<Client>(`/api/clients/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  departments: () => request<Department[]>('/api/departments'),
  certifications: () => request<Certification[]>('/api/certifications'),
  createCertification: (data: {
    code: string;
    name: string;
    issuer?: string | null;
    validityMonths?: number | null;
  }) => request<Certification>('/api/certifications', { method: 'POST', body: JSON.stringify(data) }),
  inspectors: () => request<Inspector[]>('/api/inspectors'),
  createInspector: (data: {
    employeeNo: string;
    name: string;
    departmentId: number;
    email?: string | null;
    jobTitle?: string | null;
    hireDate?: string | null;
    baseLocation?: string | null;
    weeklyCapacityHrs?: number;
    qeApproved?: boolean;
    status?: string;
  }) => request<Inspector>('/api/inspectors', { method: 'POST', body: JSON.stringify(data) }),
  inspector: (id: number) => request<InspectorDetail>(`/api/inspectors/${id}`),
  addInspectorCert: (
    inspectorId: number,
    data: { certificationId: number; issuedOn: string; expiresOn: string }
  ) =>
    request<InspectorCert>(`/api/inspectors/${inspectorId}/certs`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateInspectorCert: (
    inspectorId: number,
    certId: number,
    data: { certificationId?: number; issuedOn?: string; expiresOn?: string }
  ) =>
    request<InspectorCert>(`/api/inspectors/${inspectorId}/certs/${certId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteInspectorCert: (inspectorId: number, certId: number) =>
    request<{ ok: boolean }>(`/api/inspectors/${inspectorId}/certs/${certId}`, { method: 'DELETE' }),
  updateInspectorCosts: (inspectorId: number, data: { dailyCostUsd: number; dailyBillableUsd: number }) =>
    request<{ dailyCostUsd: number; dailyBillableUsd: number }>(`/api/inspectors/${inspectorId}/costs`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  updateInspectorQeApproved: (inspectorId: number, qeApproved: boolean) =>
    request<{ id: number; qeApproved: boolean }>(`/api/inspectors/${inspectorId}/qe-approved`, {
      method: 'PUT',
      body: JSON.stringify({ qeApproved }),
    }),
  activityLogs: (params?: { jobId?: number; inspectorId?: number }) => {
    const q = new URLSearchParams();
    if (params?.jobId) q.set('jobId', String(params.jobId));
    if (params?.inspectorId) q.set('inspectorId', String(params.inspectorId));
    const qs = q.toString();
    return request<ActivityLog[]>(`/api/activity-logs${qs ? `?${qs}` : ''}`);
  },
  createActivityLog: (data: ActivityLogPayload) =>
    request<ActivityLog>('/api/activity-logs', { method: 'POST', body: JSON.stringify(data) }),
  createActivityLogsBatch: (data: {
    jobId: number;
    inspectorId: number;
    entries: {
      logDate: string;
      hours: number;
      productiveHours: number;
      narrative?: string;
      qualityScore?: number;
    }[];
  }) =>
    request<{ created: ActivityLog[]; skipped: string[] }>('/api/activity-logs/batch', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateActivityLog: (id: number, data: Partial<ActivityLogPayload>) =>
    request<ActivityLog>(`/api/activity-logs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteActivityLog: (id: number) =>
    request(`/api/activity-logs/${id}`, { method: 'DELETE' }),
  leaveRequests: () => request<LeaveRequest[]>('/api/leave'),
  createLeave: (data: LeaveRequestPayload) =>
    request<LeaveRequest>('/api/leave', { method: 'POST', body: JSON.stringify(data) }),
  updateLeave: (id: number, data: Partial<LeaveRequestPayload>) =>
    request<LeaveRequest>(`/api/leave/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  approveLeave: (id: number) =>
    request<LeaveRequest>(`/api/leave/${id}/approve`, { method: 'POST' }),
  deleteLeave: (id: number) => request(`/api/leave/${id}`, { method: 'DELETE' }),
  auditEvents: (params?: { entityType?: string; entityId?: number; limit?: number }) => {
    const q = new URLSearchParams();
    if (params?.entityType) q.set('entityType', params.entityType);
    if (params?.entityId) q.set('entityId', String(params.entityId));
    if (params?.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request<AuditEvent[]>(`/api/audit${qs ? `?${qs}` : ''}`);
  },
  planner: (params?: { weekStart?: string; view?: 'day' | 'week' | 'month'; department?: string }) => {
    const q = new URLSearchParams();
    if (params?.weekStart) q.set('weekStart', params.weekStart);
    if (params?.view) q.set('view', params.view);
    if (params?.department) q.set('department', params.department);
    const qs = q.toString();
    return request<PlannerData>(`/api/planner${qs ? `?${qs}` : ''}`);
  },
  notifications: () => request<{ items: AppNotification[]; unreadCount: number }>('/api/notifications'),
  markNotificationRead: (id: number) =>
    request(`/api/notifications/${id}/read`, { method: 'POST' }),
  markAllNotificationsRead: () => request('/api/notifications/read-all', { method: 'POST' }),
  updateJob: (id: number, data: UpdateJobPayload) =>
    request<JobDetail>(`/api/jobs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  reports: (params?: { periodStart?: string; periodEnd?: string }) => {
    const q = new URLSearchParams();
    if (params?.periodStart) q.set('periodStart', params.periodStart);
    if (params?.periodEnd) q.set('periodEnd', params.periodEnd);
    const qs = q.toString();
    return request<ReportsData>(`/api/reports/summary${qs ? `?${qs}` : ''}`);
  },
  overdueJobs: (params?: { periodStart?: string; periodEnd?: string }) => {
    const q = new URLSearchParams();
    if (params?.periodStart) q.set('periodStart', params.periodStart);
    if (params?.periodEnd) q.set('periodEnd', params.periodEnd);
    const qs = q.toString();
    return request<OverdueJobsReport>(`/api/reports/overdue-jobs${qs ? `?${qs}` : ''}`);
  },
  activityReport: (params?: { periodStart?: string; periodEnd?: string }) => {
    const q = new URLSearchParams();
    if (params?.periodStart) q.set('periodStart', params.periodStart);
    if (params?.periodEnd) q.set('periodEnd', params.periodEnd);
    const qs = q.toString();
    return request<ActivityReport>(`/api/reports/activity${qs ? `?${qs}` : ''}`);
  },
  costReport: (params?: { periodStart?: string; periodEnd?: string }) => {
    const q = new URLSearchParams();
    if (params?.periodStart) q.set('periodStart', params.periodStart);
    if (params?.periodEnd) q.set('periodEnd', params.periodEnd);
    const qs = q.toString();
    return request<CostReport>(`/api/reports/costs${qs ? `?${qs}` : ''}`);
  },
  map: () => request<MapData>('/api/map'),
  priceChart: () => request<PriceChartData>('/api/price-chart'),
  updatePriceChart: (data: { globalDefaultUsd?: number; items?: { jobTypeId: number; priceUsd: number }[] }) =>
    request<PriceChartData>('/api/price-chart', { method: 'PUT', body: JSON.stringify(data) }),
};

export type User = { id: number; email: string; role: string; fullName: string; inspectorId?: number | null };
export type Client = {
  id: number;
  name: string;
  industry?: string | null;
  location?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contact?: string | null;
  email?: string | null;
};
export type Department = { id: number; name: string; code: string };
export type Certification = { id: number; code: string; name: string };
export type InspectorCert = {
  id: number;
  status: string;
  issuedOn: string;
  expiresOn: string;
  certification: Certification;
};

export type Inspector = {
  id: number;
  employeeNo: string;
  name: string;
  email?: string;
  department: Department;
  status: string;
  jobTitle?: string | null;
  qeApproved?: boolean;
  highestQualification?: string | null;
  dailyCostUsd?: number | null;
  dailyBillableUsd?: number | null;
  inspectorCerts?: InspectorCert[];
};

export type JobType = {
  id: number;
  code: string;
  name: string;
  description?: string;
  active?: boolean;
  defaultPriceUsd?: number | null;
  certRequirements: { certification: Certification; mandatory: boolean }[];
  _count?: { jobs: number };
};

export type JobTypePayload = {
  code: string;
  name: string;
  description?: string;
  certificationIds?: number[];
  defaultPriceUsd?: number | null;
};

export type Job = {
  id: number; ref: string; title: string; status: string; priority: string;
  startDate: string; endDate: string;
  completedAt?: string;
  client: Client; department: Department;
  jobType?: JobType;
  assignments?: Assignment[];
  proposals?: Proposal[];
  requiresQeApproval?: boolean;
  agreedPriceUsd?: number | null;
  suggestedPriceUsd?: number | null;
  location?: string | null;
  certSummary?: JobCertSummary;
};

export type JobProgress = {
  scheduledDays: number;
  scheduledStart: string;
  scheduledEnd: string;
  loggedHours: number;
  allocatedHours: number;
  workDaysLogged: number;
  daysRemaining: number;
  daysOverdue: number;
  daysEarly: number;
  timing: JobTiming;
  label: string;
  detail: string;
  isComplete: boolean;
};

export type JobDetail = Job & {
  scope?: string; location?: string; estimatedHours: number;
  closingComments?: string;
  completedAt?: string;
  completedByEmail?: string;
  managerApprovalComment?: string;
  approvedAt?: string;
  approvedByEmail?: string;
  progress?: JobProgress;
  proposals: Proposal[];
  assignments: Assignment[];
  timesheets: Timesheet[];
  certRequirements: { certification: Certification; mandatory: boolean }[];
  statusHistory: { toStatus: string; note?: string; createdAt: string; userEmail?: string }[];
};

export type Proposal = {
  id: number; score: number; rank: number; blocked: boolean;
  blockReasons?: string; warnings?: string;
  inspector: Inspector;
};

export type Assignment = {
  id: number; status: string; role: string; allocatedHours: number;
  rejectReason?: string | null;
  inspector: Inspector; job: Job;
};

export type Timesheet = {
  id: number; ref: string; status: string;
  periodStart: string; periodEnd: string;
  totalHours: number; totalProductiveHours: number;
  inspector: Inspector;
  job?: Job | null;
};

export type TimesheetLine = {
  id?: number;
  logDate: string;
  hours: number;
  productiveHours: number;
  description?: string | null;
};

export type TimesheetDetail = Timesheet & {
  lines: TimesheetLine[];
};

export type TimesheetPreview = {
  inspector: { name: string; employeeNo: string; department: string };
  periodStart: string;
  periodEnd: string;
  totalHours: number;
  totalProductiveHours: number;
  lines: {
    logDate: string;
    jobRef: string;
    jobTitle: string;
    client: string;
    hours: number;
    productiveHours: number;
    narrative?: string | null;
  }[];
};

export type JobsBoardResponse = {
  columns: {
    new: Job[];
    pendingAcceptance: Job[];
    active: Job[];
    pendingApproval: Job[];
    completed: Job[];
  };
  counts: {
    total: number;
    new: number;
    pendingAcceptance: number;
    active: number;
    pendingApproval: number;
    completed: number;
  };
  all: Job[];
};

/** @deprecated use jobsBoard */
export type PipelineResponse = JobsBoardResponse;

export type CreateJobPayload = {
  ref: string; title: string; clientId: number; departmentId: number;
  jobTypeId?: number;
  scope?: string; location?: string; startDate: string; endDate: string;
  priority?: string; estimatedHours?: number; certificationIds?: number[];
  requiresQeApproval?: boolean;
};

export type ActivityLogPayload = {
  jobId: number; inspectorId: number; logDate: string;
  hours: number; productiveHours: number; narrative?: string; qualityScore?: number;
};

export type ActivityLog = ActivityLogPayload & {
  id: number;
  createdAt: string;
  inspector: Inspector;
  job: Job;
};

export type LeaveRequest = {
  id: number;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  reason?: string | null;
  createdByEmail?: string | null;
  updatedByEmail?: string | null;
  createdAt?: string;
  updatedAt?: string;
  inspector: Inspector;
};

export type LeaveRequestPayload = {
  type: string;
  startDate: string;
  endDate: string;
  reason?: string;
  inspectorId?: number;
};

export type AuditEvent = {
  id: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  payload?: Record<string, unknown> | null;
  createdAt: string;
  user?: { email: string; fullName: string; role: string } | null;
};

export type UtilizationBand = 'available' | 'partial' | 'heavy' | 'full' | 'off';

export type PlannerAllocation = {
  id: string;
  inspectorId: number;
  kind: 'job' | 'leave' | 'training';
  title: string;
  ref?: string;
  start: string;
  end: string;
  hoursPerDay: number;
  location?: string;
  priority?: string;
  jobId?: number;
};

export type PlannerConflict = {
  inspectorId: number;
  inspectorName: string;
  date: string;
  type: 'double-booking' | 'leave-overlap' | 'training-overlap' | 'over-capacity';
  detail: string;
  hours: number;
};

export type PlannerData = {
  view: string;
  anchor: string;
  weekStart: string;
  weekEnd: string;
  days: string[];
  departments: string[];
  capacity: {
    totalCapacity: number;
    booked: number;
    onLeave: number;
    onTraining: number;
    available: number;
    utilization: number;
  };
  conflicts: PlannerConflict[];
  inspectors: {
    id: number;
    name: string;
    employeeNo: string;
    department: string;
    status: string;
    utilization: number;
    weeklyCapacityHrs: number;
    allocations: PlannerAllocation[];
    dayBands: { date: string; band: UtilizationBand; hours: number }[];
  }[];
};

/** @deprecated use PlannerData */
export type PlannerWeek = PlannerData;

export type AppNotification = {
  id: number;
  title: string;
  body: string;
  link?: string | null;
  read: boolean;
  createdAt: string;
};

export type InspectorDetail = Inspector & {
  baseLocation?: string | null;
  yearsExperience?: number;
  weeklyCapacityHrs?: number;
  costHistory?: InspectorCostHistory[];
  assignments: {
    id: number;
    status: string;
    role: string;
    allocatedHours: number;
    job: Job;
  }[];
  leaveRequests: LeaveRequest[];
  activityLogs: ActivityLog[];
  stats: {
    activeAssignments: number;
    allocatedHours: number;
    totalAssignments: number;
    certCount: number;
  };
};

export type InspectorCostHistory = {
  id: number;
  dailyCostUsd: number | null;
  dailyBillableUsd: number | null;
  changedByEmail?: string | null;
  createdAt: string;
};

export type UpdateJobPayload = {
  title?: string;
  scope?: string;
  location?: string;
  startDate?: string;
  endDate?: string;
  priority?: string;
  estimatedHours?: number;
  clientId?: number;
  departmentId?: number;
  jobTypeId?: number | null;
  requiresQeApproval?: boolean;
  agreedPriceUsd?: number | null;
};

export type DepartmentOverview = {
  id: number;
  name: string;
  code: string;
  managerEmail?: string | null;
  inspectorCount: number;
  activeJobs: number;
  openJobs: number;
  workloadPct: number;
  allocatedHours: number;
};

export type CompetencyData = {
  certifications: Certification[];
  inspectors: {
    id: number;
    employeeNo: string;
    name: string;
    department: string;
    certs: { code: string; name: string; status: string; expiresOn: string; daysToExpiry: number }[];
  }[];
  coverage: { code: string; name: string; holders: number; expiring: number }[];
  expiringList: {
    inspector: string;
    employeeNo: string;
    department: string;
    code: string;
    expires: string;
    status: string;
    days: number;
  }[];
  gaps: { code: string; name: string; holders: number }[];
  stats: {
    coveragePct: number;
    certCount: number;
    inspectorCount: number;
    expiringSoon: number;
    expired: number;
  };
};

export type OperationsDashboardData = {
  kpis: {
    openJobs: number;
    activeInspectors: number;
    activeJobs: number;
    expiringCerts: number;
    utilization: number;
  };
  utilizationSeries: { day: string; value: number }[];
  deptLoad: { dept: string; load: number }[];
  upcomingJobs: {
    id: number;
    ref: string;
    title: string;
    client: string;
    department: string;
    startDate: string;
    endDate: string;
    status: string;
    assigned: number;
    required: number;
  }[];
  recentActivity: {
    id: number;
    jobRef: string;
    jobTitle: string;
    inspector: string;
    logDate: string;
    hours: number;
    narrative?: string | null;
  }[];
  actionItems: { type: string; title: string; detail: string; link?: string }[];
};

export type InspectorPerformanceBand =
  | 'insufficient_data'
  | 'on_track'
  | 'at_risk'
  | 'overperforming'
  | 'underperforming';

export type InspectorPerformanceRow = {
  id: number;
  employeeNo: string;
  name: string;
  department: string;
  band: InspectorPerformanceBand;
  bandReason: string;
  hasRatingData: boolean;
  utilizationPct: number;
  loggedHours: number;
  allocatedHours: number;
  workDaysLogged: number;
  businessDays: number;
  fullyEngaged: boolean;
  activeJobs: number;
  completedJobs: number;
  onTimeCompletions: number;
  earlyCompletions: number;
  lateCompletions: number;
  onTimeRatePct: number | null;
  overdueActiveJobs: number;
  chronicOverdueJobs: number;
  maxOverdueDays: number;
  acceptanceRatePct: number | null;
  assignmentsAccepted: number;
  assignmentsRejected: number;
  score: number;
  highlights: string[];
};

export type ReportOverdueJob = {
  jobId: number;
  ref: string;
  title: string;
  client: string;
  department: string;
  inspectorId: number;
  inspectorName: string;
  plannedEnd: string;
  completedAt: string | null;
  daysLate: number;
  status: string;
  overdueType: 'active_overdue' | 'late_completed';
};

export type OverdueJobsReport = {
  period: { start: string; end: string };
  total: number;
  activeOverdue: number;
  lateCompleted: number;
  items: ReportOverdueJob[];
  trend?: OverdueTrendPoint[];
};

export type ProductivityTrendPoint = {
  start: string;
  end: string;
  label: string;
  utilizationPct: number;
  onTimeRatePct: number | null;
  overdueCount: number;
  completedJobs: number;
};

export type OverdueTrendPoint = {
  start: string;
  end: string;
  label: string;
  total: number;
  activeOverdue: number;
  lateCompleted: number;
};

export type ReportsData = {
  period: { start: string; end: string; businessDays: number };
  methodology?: {
    benchmarks: Record<string, number>;
    rules: string[];
  };
  scorecard: {
    utilization: number;
    onTimeLogs: number | null;
    compliance: number;
    activeInspectors: number;
    expiringCerts: number;
  };
  performance: {
    period: { start: string; end: string; businessDays: number };
    methodology?: {
      benchmarks: Record<string, number>;
      rules: string[];
    };
    scorecard: {
      avgUtilization: number;
      avgOnTime: number | null;
      avgAcceptance: number | null;
      fullyEngagedCount: number;
      inspectorCount: number;
      overperformingCount: number;
      underperformingCount: number;
      atRiskCount: number;
    };
    inspectors: InspectorPerformanceRow[];
    overperforming: InspectorPerformanceRow[];
    underperforming: InspectorPerformanceRow[];
    atRisk: InspectorPerformanceRow[];
    onTimeFinishers: InspectorPerformanceRow[];
    fullyEngaged: InspectorPerformanceRow[];
  };
  overdueJobs?: Omit<OverdueJobsReport, 'period'>;
  productivityTrend?: ProductivityTrendPoint[];
};

export type ActivityReportItem = {
  id: number;
  logDate: string;
  hours: number;
  productiveHours: number;
  narrative?: string | null;
  inspectorId: number;
  inspectorName: string;
  employeeNo: string;
  jobId: number;
  jobRef: string;
  jobTitle: string;
  jobStatus: string;
  client: string;
};

export type ActivityReport = {
  period: { start: string; end: string };
  totals: { entries: number; hours: number; productiveHours: number; inspectors: number; jobs: number };
  items: ActivityReportItem[];
};

export type CostReportInspector = {
  inspectorId: number;
  inspectorName: string;
  employeeNo: string;
  hours: number;
  costQar: number;
  billableQar: number;
  revenueQar: number;
  marginQar: number;
  jobs: number;
};

export type CostReportJob = {
  jobId: number;
  jobRef: string;
  jobTitle: string;
  jobStatus: string;
  client: string;
  inspectorId: number;
  inspectorName: string;
  employeeNo: string;
  hours: number;
  dailyCostUsd: number | null;
  dailyBillableUsd: number | null;
  rateSource: 'assignment' | 'current' | 'none';
  costQar: number;
  billableQar: number;
  agreedPriceUsd: number | null;
  revenueQar: number | null;
  marginQar: number | null;
};

export type CostReport = {
  period: { start: string; end: string };
  methodology: { hoursPerDay: number; notes: string[] };
  totals: {
    hours: number;
    costQar: number;
    billableQar: number;
    revenueQar: number;
    marginQar: number;
    inspectors: number;
    jobs: number;
  };
  inspectors: CostReportInspector[];
  jobs: CostReportJob[];
};

export type MapStage = 'new' | 'active' | 'completed';

export type MapClient = {
  id: number;
  name: string;
  location?: string | null;
  latitude: number | null;
  longitude: number | null;
  openJobCount: number;
  counts: { new: number; active: number; completed: number };
  primaryStage: MapStage | null;
};

export type MapJob = {
  id: number;
  ref: string;
  title: string;
  status: string;
  stage: MapStage;
  location?: string | null;
  clientId: number;
  clientName: string;
  latitude: number;
  longitude: number;
};

export type MapData = {
  clients: MapClient[];
  jobs: MapJob[];
};

export type PriceChartData = {
  globalDefaultUsd: number;
  items: { jobTypeId: number; code: string; name: string; priceUsd: number | null }[];
};
