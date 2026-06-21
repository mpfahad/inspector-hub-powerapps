/**
 * Power Fx–style data operations for SharePoint connector simulation.
 * Only delegable patterns are used in Filter — see comments for PowerFx equivalents.
 */

import type { SPRecord } from './types';

export const DATA_ROW_LIMIT_DEFAULT = 500;
export const DATA_ROW_LIMIT_MAX = 2000;
export const PAGE_SIZE = 100;

type Predicate<T> = (record: T) => boolean;

/** PowerFx: Filter(Jobs, Status = varFilterJobStatus) — delegable when Status is indexed Choice */
export function Filter<T extends SPRecord>(
  source: T[],
  predicate: Predicate<T>,
  options?: { delegable?: boolean; dataRowLimit?: number; page?: number }
): T[] {
  const limit = options?.dataRowLimit ?? DATA_ROW_LIMIT_DEFAULT;
  const page = options?.page ?? 0;
  const filtered = source.filter(predicate);

  if (options?.delegable === false) {
    console.warn('[Delegation] Filter uses non-delegable criteria — only first', limit, 'rows processed');
  }

  const start = page * PAGE_SIZE;
  return filtered.slice(start, start + Math.min(PAGE_SIZE, limit));
}

/** PowerFx: LookUp(Inspectors, ID = ThisItem.DepartmentId) */
export function LookUp<T extends SPRecord>(
  source: T[],
  match: Predicate<T>
): T | undefined {
  return source.find(match);
}

/** PowerFx: CountRows(Filter(Jobs, Status = "In Progress")) — CountIf is NOT delegable; use CountRows+Filter */
export function CountRows<T>(table: T[]): number {
  return table.length;
}

/** PowerFx: Sum(Filter(ActivityLogs, JobId = varSelectedJobId), ProductiveHours) */
export function Sum<T>(table: T[], selector: (item: T) => number): number {
  return table.reduce((acc, item) => acc + selector(item), 0);
}

/** PowerFx: Patch(Jobs, Defaults(Jobs), { Title: txtRef.Text, ... }) */
export function Patch<T extends SPRecord>(
  source: T[],
  defaults: Partial<T>,
  changes: Partial<T>
): T {
  const nextId = Math.max(0, ...source.map((r) => r.ID)) + 1;
  return { ...defaults, ...changes, ID: nextId } as T;
}

/** PowerFx: Patch(Jobs, galJobs.Selected, { Status: "Completed" }) */
export function PatchExisting<T extends SPRecord>(
  record: T,
  changes: Partial<T>
): T {
  return { ...record, ...changes };
}

/** PowerFx: Remove(Jobs, galJobs.Selected) */
export function Remove<T extends SPRecord>(source: T[], record: T): T[] {
  return source.filter((r) => r.ID !== record.ID);
}

/** PowerFx: ClearCollect(colJobs, Filter(Jobs, Status <> "Cancelled")) */
export function ClearCollect<T>(collection: T[], source: T[]): T[] {
  collection.length = 0;
  collection.push(...source);
  return collection;
}

/** PowerFx: Sort(Jobs, StartDate, SortOrder.Descending) — Sort on Choice/Lookup is limited in SP */
export function Sort<T>(source: T[], selector: (item: T) => string | number, descending = false): T[] {
  return [...source].sort((a, b) => {
    const av = selector(a);
    const bv = selector(b);
    if (av < bv) return descending ? 1 : -1;
    if (av > bv) return descending ? -1 : 1;
    return 0;
  });
}

/** PowerFx: Concat(LookUp columns) — display helper for lookup Title */
export function DisplayLookup<T extends SPRecord>(
  source: T[],
  id: number | undefined,
  fallback = '—'
): string {
  if (id == null) return fallback;
  return LookUp(source, (r) => r.ID === id)?.Title ?? fallback;
}
