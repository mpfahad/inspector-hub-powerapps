/** SharePoint record shape — every list item has ID + optional Title */
export interface SPRecord {
  ID: number;
  Title?: string;
}

export interface Department extends SPRecord {
  Code: string;
  ManagerEmail?: string;
  InspectorCount?: number;
  ActiveCount?: number;
}

export interface Client extends SPRecord {
  Industry: string;
  Location: string;
  Contact?: string;
  Email?: string;
  ProjectCount?: number;
  JobCount?: number;
}

export interface InspectorCert extends SPRecord {
  InspectorName: string;
  CertName: string;
  IssuedOn: string;
  ExpiresOn: string;
  Status: 'Valid' | 'Expiring Soon' | 'Expired';
}

export interface Inspector extends SPRecord {
  EmployeeNo: string;
  DepartmentId: number;
  BaseLocation: string;
  Status: 'Active' | 'On Leave' | 'Training' | 'Inactive';
  HireDate: string;
  Utilization?: number;
}

export interface Job extends SPRecord {
  ClientId: number;
  DepartmentId: number;
  Scope: string;
  StartDate: string;
  EndDate: string;
  Status: 'Draft' | 'Scheduled' | 'In Progress' | 'Completed' | 'Cancelled';
  Priority: 'Low' | 'Medium' | 'High' | 'Critical';
  Progress?: number;
}

export interface Assignment extends SPRecord {
  JobId: number;
  InspectorId: number;
  AllocatedHours: number;
  Role: 'Lead' | 'Support' | 'Trainee' | 'Reviewer';
  Status: 'Proposed' | 'Confirmed' | 'In Progress' | 'Complete' | 'Cancelled';
  CreatedByEmail: string;
  DecidedAt?: string;
}

export interface ActivityLog extends SPRecord {
  InspectorId: number;
  JobId: number;
  LogDate: string;
  Hours: number;
  ProductiveHours: number;
  Narrative: string;
  QualityScore: number;
}

export interface LeaveRequest extends SPRecord {
  InspectorId: number;
  Type: 'Annual' | 'Sick' | 'Training' | 'Other';
  StartDate: string;
  EndDate: string;
  Status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  ApproverEmail?: string;
}

export interface Qualification extends SPRecord {
  Category: string;
  Level: string;
  Body: string;
  Holders: number;
}

export type ListName =
  | 'Departments'
  | 'Clients'
  | 'Inspectors'
  | 'Jobs'
  | 'Assignments'
  | 'ActivityLogs'
  | 'LeaveRequests'
  | 'Qualifications'
  | 'InspectorCerts';

export type ScreenName =
  | 'scrLogin'
  | 'scrHome'
  | 'scrDepartments'
  | 'scrJobs'
  | 'scrJobDetail'
  | 'scrAssignments'
  | 'scrInspectors'
  | 'scrInspectorDetail'
  | 'scrPlanner'
  | 'scrQualifications'
  | 'scrCompetency'
  | 'scrActivityLog'
  | 'scrLeave'
  | 'scrDashboards'
  | 'scrReports'
  | 'scrWorkflows'
  | 'scrAdmin';

export type UserRole = 'Admin' | 'Manager' | 'Inspector';

export interface AppVariables {
  varIsAuthenticated: boolean;
  varCurrentUserEmail: string;
  varUserRole: UserRole;
  varSelectedJobId: number | null;
  varSelectedInspectorId: number | null;
  varFilterJobStatus: string;
  varFilterInspectorStatus: string;
  varDataRowLimit: number;
  varGalleryPage: number;
  varFormMode: 'New' | 'Edit' | 'View';
  varIsLoading: boolean;
  varStatusMessage: string;
}
