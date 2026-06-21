/** Seed data aligned with lovable-source/src/lib/mock-data.ts — SharePoint numeric IDs */
import type {
  ActivityLog,
  Assignment,
  Client,
  Department,
  Inspector,
  InspectorCert,
  Job,
  LeaveRequest,
  Qualification,
} from './types';

export const seedDepartments: Department[] = [
  { ID: 1, Title: 'Mechanical Inspection', Code: 'MECH', ManagerEmail: 's.hollis@company.com', InspectorCount: 18, ActiveCount: 12 },
  { ID: 2, Title: 'Electrical Inspection', Code: 'ELEC', ManagerEmail: 'm.chen@company.com', InspectorCount: 14, ActiveCount: 9 },
  { ID: 3, Title: 'Civil Inspection', Code: 'CIV', ManagerEmail: 'p.rao@company.com', InspectorCount: 22, ActiveCount: 15 },
  { ID: 4, Title: 'HSE Inspection', Code: 'HSE', ManagerEmail: 'j.oconnor@company.com', InspectorCount: 11, ActiveCount: 7 },
  { ID: 5, Title: 'NDT Inspection', Code: 'NDT', ManagerEmail: 'e.vasquez@company.com', InspectorCount: 16, ActiveCount: 11 },
];

export const seedClients: Client[] = [
  { ID: 1, Title: 'Northshore Energy', Industry: 'Oil & Gas', Location: 'Houston', Contact: 'L. Pereira', Email: 'lpereira@northshore.energy', ProjectCount: 3, JobCount: 12 },
  { ID: 2, Title: 'Helios Power', Industry: 'Power', Location: 'Phoenix', Contact: 'M. Abbasi', Email: 'm.abbasi@helios.com', ProjectCount: 2, JobCount: 7 },
  { ID: 3, Title: 'Atlas Construction', Industry: 'Construction', Location: 'Dallas', Contact: 'R. Whitford', Email: 'rw@atlascon.com', ProjectCount: 4, JobCount: 18 },
];

export const seedInspectors: Inspector[] = [
  { ID: 1, Title: 'Daniel Okafor', EmployeeNo: 'E-1042', DepartmentId: 1, BaseLocation: 'Houston, TX', Status: 'Active', HireDate: '2014-03-15', Utilization: 86 },
  { ID: 2, Title: 'Mei Lin', EmployeeNo: 'E-1058', DepartmentId: 5, BaseLocation: 'San Diego, CA', Status: 'Active', HireDate: '2018-07-01', Utilization: 72 },
  { ID: 3, Title: 'Carlos Ibañez', EmployeeNo: 'E-1077', DepartmentId: 2, BaseLocation: 'Phoenix, AZ', Status: 'Active', HireDate: '2020-01-20', Utilization: 91 },
  { ID: 4, Title: 'Aisha Rahman', EmployeeNo: 'E-1083', DepartmentId: 3, BaseLocation: 'Dallas, TX', Status: 'On Leave', HireDate: '2016-11-20', Utilization: 0 },
  { ID: 5, Title: 'Henrik Sørensen', EmployeeNo: 'E-1096', DepartmentId: 4, BaseLocation: 'Anchorage, AK', Status: 'Active', HireDate: '2012-09-01', Utilization: 64 },
  { ID: 6, Title: 'Olivia Brennan', EmployeeNo: 'E-1119', DepartmentId: 5, BaseLocation: 'New Orleans, LA', Status: 'Active', HireDate: '2015-05-10', Utilization: 88 },
  { ID: 7, Title: 'Rafael Mendes', EmployeeNo: 'E-1132', DepartmentId: 3, BaseLocation: 'Miami, FL', Status: 'Active', HireDate: '2019-08-01', Utilization: 78 },
];

export const seedJobs: Job[] = [
  { ID: 1, Title: 'J-2026-00184', ClientId: 1, DepartmentId: 1, Scope: 'Pressure Vessel Inspection — Skid 7', StartDate: '2026-06-11', EndDate: '2026-06-15', Status: 'In Progress', Priority: 'High', Progress: 64 },
  { ID: 2, Title: 'J-2026-00185', ClientId: 2, DepartmentId: 2, Scope: 'Switchgear Acceptance Test', StartDate: '2026-06-10', EndDate: '2026-06-12', Status: 'Scheduled', Priority: 'Critical', Progress: 20 },
  { ID: 3, Title: 'J-2026-00187', ClientId: 1, DepartmentId: 5, Scope: 'Phased Array UT — Pipeline 4B', StartDate: '2026-06-13', EndDate: '2026-06-17', Status: 'Draft', Priority: 'High', Progress: 0 },
  { ID: 4, Title: 'J-2026-00186', ClientId: 3, DepartmentId: 3, Scope: 'Foundation Concrete QC', StartDate: '2026-06-12', EndDate: '2026-06-18', Status: 'Draft', Priority: 'Medium', Progress: 0 },
  { ID: 5, Title: 'J-2026-00188', ClientId: 3, DepartmentId: 4, Scope: 'Site HSE Audit — Q2', StartDate: '2026-06-14', EndDate: '2026-06-14', Status: 'Draft', Priority: 'Medium', Progress: 0 },
  { ID: 6, Title: 'J-2026-00181', ClientId: 2, DepartmentId: 1, Scope: 'MOV Functional Test', StartDate: '2026-06-04', EndDate: '2026-06-06', Status: 'Completed', Priority: 'Low', Progress: 100 },
];

export const seedAssignments: Assignment[] = [
  { ID: 1, Title: 'A-9003', JobId: 1, InspectorId: 1, AllocatedHours: 45, Role: 'Lead', Status: 'In Progress', CreatedByEmail: 'coordinator@company.com', DecidedAt: '2026-06-09T14:20:00Z' },
  { ID: 2, Title: 'A-9001', JobId: 2, InspectorId: 3, AllocatedHours: 27, Role: 'Lead', Status: 'Proposed', CreatedByEmail: 'coordinator@company.com' },
  { ID: 3, Title: 'A-9002', JobId: 3, InspectorId: 2, AllocatedHours: 40, Role: 'Lead', Status: 'Proposed', CreatedByEmail: 'coordinator@company.com' },
  { ID: 4, Title: 'A-9004', JobId: 4, InspectorId: 7, AllocatedHours: 56, Role: 'Lead', Status: 'Confirmed', CreatedByEmail: 'coordinator@company.com', DecidedAt: '2026-06-10T07:55:00Z' },
  { ID: 5, Title: 'A-9005', JobId: 5, InspectorId: 5, AllocatedHours: 6, Role: 'Lead', Status: 'Cancelled', CreatedByEmail: 'coordinator@company.com' },
];

export const seedActivityLogs: ActivityLog[] = [
  { ID: 1, Title: 'L-5501', InspectorId: 1, JobId: 1, LogDate: '2026-06-10', Hours: 9.5, ProductiveHours: 9, Narrative: 'Completed external visual on 3 of 4 nozzles.', QualityScore: 92 },
  { ID: 2, Title: 'L-5502', InspectorId: 6, JobId: 1, LogDate: '2026-06-10', Hours: 8, ProductiveHours: 7.5, Narrative: 'PT performed on weld seam W-12.', QualityScore: 90 },
  { ID: 3, Title: 'L-5504', InspectorId: 7, JobId: 4, LogDate: '2026-06-10', Hours: 6.5, ProductiveHours: 6, Narrative: 'Slump tests on grid B-3 to B-6.', QualityScore: 85 },
];

export const seedLeaveRequests: LeaveRequest[] = [
  { ID: 1, Title: 'LV-3201', InspectorId: 4, Type: 'Annual', StartDate: '2026-06-08', EndDate: '2026-06-20', Status: 'Approved', ApproverEmail: 'manager@company.com' },
  { ID: 2, Title: 'LV-3203', InspectorId: 3, Type: 'Annual', StartDate: '2026-06-22', EndDate: '2026-06-26', Status: 'Pending', ApproverEmail: 'manager@company.com' },
  { ID: 3, Title: 'LV-3204', InspectorId: 2, Type: 'Other', StartDate: '2026-07-01', EndDate: '2026-07-02', Status: 'Pending', ApproverEmail: 'manager@company.com' },
];

export const seedQualifications: Qualification[] = [
  { ID: 1, Title: 'CSWIP 3.1 Welding Inspector', Category: 'Welding', Level: 'L3', Body: 'TWI', Holders: 18 },
  { ID: 2, Title: 'API 510 Pressure Vessel', Category: 'Pressure', Level: 'L3', Body: 'API', Holders: 9 },
  { ID: 3, Title: 'PCN Level II PAUT', Category: 'NDT', Level: 'L2', Body: 'BINDT', Holders: 11 },
  { ID: 4, Title: 'NEBOSH IGC', Category: 'HSE', Level: 'L2', Body: 'NEBOSH', Holders: 14 },
];

export const seedKpis = {
  utilization: 78,
  openJobs: 14,
  activeInspectors: 54,
  pendingApprovals: 11,
  expiringCerts: 4,
  acceptanceRate: 92,
};

export const seedInspectorCerts: InspectorCert[] = [
  { ID: 1, Title: 'API 510', InspectorName: 'Daniel Okafor', CertName: 'API 510 Pressure Vessel', IssuedOn: '2024-02-12', ExpiresOn: '2027-02-12', Status: 'Valid' },
  { ID: 2, Title: 'PCN PAUT', InspectorName: 'Mei Lin', CertName: 'PCN Level II PAUT', IssuedOn: '2021-09-08', ExpiresOn: '2026-09-08', Status: 'Expiring Soon' },
  { ID: 3, Title: 'ASNT RT', InspectorName: 'Olivia Brennan', CertName: 'ASNT Level II RT', IssuedOn: '2023-04-01', ExpiresOn: '2026-07-01', Status: 'Expiring Soon' },
  { ID: 4, Title: 'ACI', InspectorName: 'Aisha Rahman', CertName: 'ACI Concrete Field Tech', IssuedOn: '2020-11-14', ExpiresOn: '2025-11-14', Status: 'Expired' },
  { ID: 5, Title: 'CSWIP', InspectorName: 'Carlos Ibañez', CertName: 'CSWIP 3.1 Welding Inspector', IssuedOn: '2025-01-20', ExpiresOn: '2030-01-20', Status: 'Valid' },
];

export const utilizationSeries = [
  { day: 'Mon', value: 74 },
  { day: 'Tue', value: 81 },
  { day: 'Wed', value: 79 },
  { day: 'Thu', value: 85 },
  { day: 'Fri', value: 88 },
  { day: 'Sat', value: 62 },
  { day: 'Sun', value: 48 },
];

export const deptLoad = [
  { dept: 'Mechanical', load: 86 },
  { dept: 'Electrical', load: 71 },
  { dept: 'Civil', load: 92 },
  { dept: 'HSE', load: 54 },
  { dept: 'NDT', load: 78 },
];

export const leaderboard = [
  { name: 'Olivia Brennan', dept: 'NDT', jobs: 31, hours: 412, score: 96 },
  { name: 'Daniel Okafor', dept: 'Mechanical', jobs: 28, hours: 398, score: 94 },
  { name: 'Carlos Ibañez', dept: 'Electrical', jobs: 26, hours: 384, score: 91 },
  { name: 'Rafael Mendes', dept: 'Civil', jobs: 24, hours: 362, score: 88 },
  { name: 'Mei Lin', dept: 'NDT', jobs: 22, hours: 348, score: 87 },
];

export const heatmap: Record<string, number[]> = {
  Mechanical: [72, 80, 84, 88, 92, 60, 40],
  Electrical: [64, 72, 78, 82, 86, 55, 30],
  Civil: [85, 90, 94, 96, 98, 70, 45],
  HSE: [40, 52, 58, 62, 66, 35, 20],
  NDT: [70, 76, 82, 86, 90, 58, 38],
};

export const heatmapDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export type WorkflowNotification = {
  ID: number;
  Title: string;
  Trigger: string;
  Audience: string;
  Channels: string;
  Severity: 'info' | 'success' | 'warn' | 'critical';
  Timing: string;
};

export const seedWorkflows: WorkflowNotification[] = [
  { ID: 1, Title: 'New Job Assignment', Trigger: 'On assignment created (Proposed)', Audience: 'Inspector, Coordinator', Channels: 'Email, In-App, Push', Severity: 'info', Timing: 'Immediate' },
  { ID: 2, Title: 'Assignment Accepted', Trigger: 'On status → Confirmed', Audience: 'Coordinator, Manager', Channels: 'Email, In-App', Severity: 'success', Timing: 'Immediate' },
  { ID: 3, Title: 'Assignment Rejected', Trigger: 'On status → Cancelled', Audience: 'Coordinator, Manager', Channels: 'Email, In-App, Push', Severity: 'warn', Timing: 'Immediate' },
  { ID: 4, Title: 'Daily Log Reminder', Trigger: 'Scheduled 17:00 if no log', Audience: 'Inspector', Channels: 'Push, In-App, Email', Severity: 'info', Timing: '17:00 daily' },
  { ID: 5, Title: 'Overdue Job', Trigger: 'EndDate < Today AND Status <> Completed', Audience: 'Manager, Coordinator', Channels: 'Email, In-App', Severity: 'critical', Timing: 'Daily 08:00' },
  { ID: 6, Title: 'Cert Expiry Alert', Trigger: 'ExpiresOn in 90/30/7 days', Audience: 'Inspector, Manager', Channels: 'Email, In-App', Severity: 'warn', Timing: 'Scheduled' },
  { ID: 7, Title: 'Leave Approved', Trigger: 'On LeaveRequests.Status → Approved', Audience: 'Inspector', Channels: 'Email, In-App', Severity: 'success', Timing: 'Immediate' },
];

export const seedApprovals = [
  { process: 'Leave (≤3 days)', l1: 'Dept Manager', l2: '—', sla: '1 business day' },
  { process: 'Leave (>3 days)', l1: 'Dept Manager', l2: 'Ops Manager', sla: '2 business days' },
  { process: 'Job Closure', l1: 'Coordinator', l2: 'Dept Manager', sla: '1 business day' },
  { process: 'Assignment Rejection', l1: 'Coordinator', l2: 'Dept Manager', sla: 'Same day' },
];

export const reportCatalog = [
  { name: 'Inspector Utilization', desc: 'Hours, billable %, idle days per inspector and department.' },
  { name: 'Department Workload', desc: 'Coverage ratio and 30-day forecast by department.' },
  { name: 'Assignment Performance', desc: 'Acceptance, rejection reasons, and SLA lead time.' },
  { name: 'Certification Compliance', desc: 'Per-inspector valid/expiring/expired counts.' },
  { name: 'Leave Calendar', desc: 'Approved and pending leave by department.' },
  { name: 'Client Billing Export', desc: 'Hours per job per client, ready for invoicing.' },
];
