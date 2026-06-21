/**
 * Simulates SharePoint list connector — in Canvas this is the built-in SharePoint data source.
 * Replace method bodies with SharePointIntegration or REST calls when porting.
 */

import {
  seedActivityLogs,
  seedAssignments,
  seedClients,
  seedDepartments,
  seedInspectors,
  seedJobs,
  seedLeaveRequests,
  seedQualifications,
} from './seedData';
import type {
  ActivityLog,
  Assignment,
  Client,
  Department,
  Inspector,
  Job,
  LeaveRequest,
  ListName,
  Qualification,
} from './types';
import { Patch, PatchExisting, Remove } from './operations';

type ListMap = {
  Departments: Department;
  Clients: Client;
  Inspectors: Inspector;
  Jobs: Job;
  Assignments: Assignment;
  ActivityLogs: ActivityLog;
  LeaveRequests: LeaveRequest;
  Qualifications: Qualification;
};

const store: { [K in ListName]: ListMap[K][] } = {
  Departments: [...seedDepartments],
  Clients: [...seedClients],
  Inspectors: [...seedInspectors],
  Jobs: [...seedJobs],
  Assignments: [...seedAssignments],
  ActivityLogs: [...seedActivityLogs],
  LeaveRequests: [...seedLeaveRequests],
  Qualifications: [...seedQualifications],
};

/** PowerFx: Jobs — direct list reference in formulas */
export function getList<K extends ListName>(listName: K): ListMap[K][] {
  return store[listName] as ListMap[K][];
}

export function patchNew<K extends ListName>(
  listName: K,
  defaults: Partial<ListMap[K]>,
  changes: Partial<ListMap[K]>
): ListMap[K] {
  const list = store[listName] as ListMap[K][];
  const record = Patch(list, defaults as ListMap[K], changes as Partial<ListMap[K]>);
  list.push(record);
  return record;
}

export function patchExisting<K extends ListName>(
  listName: K,
  record: ListMap[K],
  changes: Partial<ListMap[K]>
): ListMap[K] {
  const list = store[listName] as ListMap[K][];
  const idx = list.findIndex((r) => r.ID === record.ID);
  if (idx < 0) return record;
  const updated = PatchExisting(record, changes);
  list[idx] = updated;
  return updated;
}

export function removeRecord<K extends ListName>(listName: K, record: ListMap[K]): void {
  const list = store[listName] as ListMap[K][];
  store[listName] = Remove(list, record) as typeof store[K];
}

/** Refresh all lists — PowerFx: Refresh(Jobs) */
export function refresh(listName?: ListName): void {
  if (listName) {
    // In real SharePoint: Refresh(listName) re-fetches from server
    return;
  }
}
