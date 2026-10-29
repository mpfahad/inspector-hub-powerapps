import { STANDARD_DAY_HOURS } from './plannerService.js';

/** Field-services benchmarks aligned with common inspection / professional-services KPIs */
export const PERFORMANCE_BENCHMARKS = {
  /** Target billable utilization band (productive, sustainable) */
  UTILIZATION_TARGET_MIN: 70,
  UTILIZATION_TARGET_MAX: 85,
  /** Sustained under-utilization threshold */
  UTILIZATION_UNDER: 60,
  /** Over-allocation / burnout risk */
  UTILIZATION_OVERALLOCATED: 92,
  /** Organisation OTIF (on-time in full) target */
  ON_TIME_TARGET: 95,
  /** Individual schedule adherence concern */
  ON_TIME_UNDER: 80,
  /** Minimum closed jobs before schedule adherence affects band */
  MIN_COMPLETED_FOR_SCHEDULE: 3,
  /** Minimum exposure before utilization affects band (≈3 working days) */
  MIN_LOGGED_HOURS_FOR_RATING: 24,
  MIN_WORK_DAYS_FOR_RATING: 5,
  /** Days past planned end before an active job is “chronic” overdue */
  CHRONIC_OVERDUE_DAYS: 3,
  /** Full-month engagement: ≥85% util over most available days */
  FULL_ENGAGEMENT_UTIL: 85,
  FULL_ENGAGEMENT_MIN_DAYS: 18,
} as const;

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

export type OverdueJobType = 'active_overdue' | 'late_completed';

export type OverdueJobRow = {
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
  overdueType: OverdueJobType;
};

function toDateOnly(value: Date | string) {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString().slice(0, 10);
}

function dayDiff(from: string, to: string) {
  const a = new Date(from + 'T12:00:00');
  const b = new Date(to + 'T12:00:00');
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

function businessDaysBetween(start: string, end: string) {
  let count = 0;
  const cursor = new Date(start + 'T12:00:00');
  const last = new Date(end + 'T12:00:00');
  while (cursor <= last) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return Math.max(1, count);
}

function overlapsPeriod(start: Date, end: Date, periodStart: string, periodEnd: string) {
  const s = toDateOnly(start);
  const e = toDateOnly(end);
  return s <= periodEnd && e >= periodStart;
}

function completionTiming(completedAt: Date, endDate: Date) {
  const completed = toDateOnly(completedAt);
  const end = toDateOnly(endDate);
  if (completed < end) return 'early' as const;
  if (completed === end) return 'on_time' as const;
  return 'late' as const;
}

function percentile(values: number[], p: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx] ?? 0;
}

type ClassifyInput = {
  utilizationPct: number;
  onTimeRatePct: number | null;
  completedJobs: number;
  lateCompletions: number;
  overdueActiveJobs: number;
  chronicOverdueJobs: number;
  maxOverdueDays: number;
  workDaysLogged: number;
  loggedHours: number;
  availableDays: number;
  fullyEngaged: boolean;
  teamMedianUtilization: number;
  teamP75Utilization: number;
};

function hasMinimumExposure(input: ClassifyInput) {
  return (
    input.workDaysLogged >= PERFORMANCE_BENCHMARKS.MIN_WORK_DAYS_FOR_RATING ||
    input.loggedHours >= PERFORMANCE_BENCHMARKS.MIN_LOGGED_HOURS_FOR_RATING
  );
}

function hasScheduleSample(input: ClassifyInput) {
  return input.completedJobs >= PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE;
}

function classifyBand(input: ClassifyInput): { band: InspectorPerformanceBand; reason: string } {
  if (!hasMinimumExposure(input)) {
    return {
      band: 'insufficient_data',
      reason: `Need ≥${PERFORMANCE_BENCHMARKS.MIN_WORK_DAYS_FOR_RATING} work days or ≥${PERFORMANCE_BENCHMARKS.MIN_LOGGED_HOURS_FOR_RATING}h logged before rating`,
    };
  }

  const utilUnder =
    input.availableDays >= 10 && input.utilizationPct < PERFORMANCE_BENCHMARKS.UTILIZATION_UNDER;
  const utilOverallocated = input.utilizationPct >= PERFORMANCE_BENCHMARKS.UTILIZATION_OVERALLOCATED;

  const scheduleUnder =
    hasScheduleSample(input) &&
    input.onTimeRatePct !== null &&
    input.onTimeRatePct < PERFORMANCE_BENCHMARKS.ON_TIME_UNDER;

  const chronicLatePattern =
    hasScheduleSample(input) &&
    input.lateCompletions / input.completedJobs >= 0.4;

  const chronicOverdue =
    input.chronicOverdueJobs >= 1 || input.overdueActiveJobs >= 2;

  const underSignals = [utilUnder, scheduleUnder, chronicLatePattern, chronicOverdue].filter(Boolean).length;

  if (underSignals >= 2) {
    const parts: string[] = [];
    if (utilUnder) parts.push(`utilization ${input.utilizationPct}% (<${PERFORMANCE_BENCHMARKS.UTILIZATION_UNDER}%)`);
    if (scheduleUnder) parts.push(`on-time ${input.onTimeRatePct}% on ${input.completedJobs} jobs`);
    if (chronicLatePattern) parts.push(`${input.lateCompletions}/${input.completedJobs} late completions`);
    if (chronicOverdue) parts.push(`${input.chronicOverdueJobs} chronic overdue`);
    return {
      band: 'underperforming',
      reason: `Sustained underperformance: ${parts.join('; ')}`,
    };
  }

  const inTargetUtil =
    input.utilizationPct >= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN &&
    input.utilizationPct <= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MAX;

  const strongSchedule =
    !hasScheduleSample(input) ||
    (input.onTimeRatePct !== null && input.onTimeRatePct >= PERFORMANCE_BENCHMARKS.ON_TIME_TARGET - 3);

  const topQuartile =
    input.utilizationPct >= input.teamP75Utilization &&
    input.utilizationPct >= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN &&
    input.utilizationPct < PERFORMANCE_BENCHMARKS.UTILIZATION_OVERALLOCATED;

  if (
    !chronicOverdue &&
    strongSchedule &&
    (inTargetUtil || topQuartile) &&
    (input.fullyEngaged || input.workDaysLogged >= 12)
  ) {
    return {
      band: 'overperforming',
      reason: inTargetUtil
        ? `Target utilization (${PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN}–${PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MAX}%) with strong schedule adherence`
        : `Top-quartile utilization (${input.utilizationPct}%) with strong schedule adherence`,
    };
  }

  const atRiskSignals: string[] = [];
  if (input.overdueActiveJobs === 1 && input.maxOverdueDays < PERFORMANCE_BENCHMARKS.CHRONIC_OVERDUE_DAYS) {
    atRiskSignals.push('1 active job slightly overdue');
  }
  if (input.lateCompletions === 1 && !hasScheduleSample(input)) {
    atRiskSignals.push('1 late completion (sample too small to rate schedule)');
  }
  if (utilOverallocated) atRiskSignals.push('utilization above sustainable band');
  if (
    input.utilizationPct < PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN &&
    input.utilizationPct >= PERFORMANCE_BENCHMARKS.UTILIZATION_UNDER
  ) {
    atRiskSignals.push('utilization below target band');
  }

  if (atRiskSignals.length > 0) {
    return { band: 'at_risk', reason: atRiskSignals.join('; ') };
  }

  return { band: 'on_track', reason: 'Meeting utilization and schedule benchmarks for the period' };
}

function buildHighlights(row: Omit<InspectorPerformanceRow, 'highlights' | 'band' | 'bandReason' | 'score'>) {
  const highlights: string[] = [];
  if (row.fullyEngaged) highlights.push('Fully engaged this period');
  if (
    row.onTimeRatePct !== null &&
    row.onTimeRatePct === 100 &&
    row.completedJobs >= PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE
  ) {
    highlights.push('100% on-time over rated sample');
  }
  if (row.earlyCompletions > 0) {
    highlights.push(`${row.earlyCompletions} early completion${row.earlyCompletions === 1 ? '' : 's'}`);
  }
  if (row.lateCompletions > 0 && row.completedJobs < PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE) {
    highlights.push(`${row.lateCompletions} late (sample <${PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE} jobs)`);
  } else if (row.lateCompletions > 0) {
    highlights.push(`${row.lateCompletions} late completion${row.lateCompletions === 1 ? '' : 's'}`);
  }
  if (row.chronicOverdueJobs > 0) {
    highlights.push(`${row.chronicOverdueJobs} chronic overdue`);
  } else if (row.overdueActiveJobs > 0) {
    highlights.push(`${row.overdueActiveJobs} overdue active`);
  }
  if (row.utilizationPct < PERFORMANCE_BENCHMARKS.UTILIZATION_UNDER) highlights.push('Low utilization');
  if (
    row.utilizationPct >= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN &&
    row.utilizationPct <= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MAX
  ) {
    highlights.push('In target utilization band');
  }
  return highlights.slice(0, 4);
}

function performanceScore(row: {
  utilizationPct: number;
  onTimeRatePct: number | null;
  chronicOverdueJobs: number;
  overdueActiveJobs: number;
  completedJobs: number;
}) {
  const util = Math.min(100, row.utilizationPct);
  const utilScore =
    util >= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN &&
    util <= PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MAX
      ? 100
      : util < PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN
        ? Math.round((util / PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN) * 100)
        : Math.max(60, 100 - (util - PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MAX) * 2);

  const onTime =
    row.completedJobs >= PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE
      ? (row.onTimeRatePct ?? 75)
      : 75;

  const overduePenalty = row.chronicOverdueJobs * 15 + Math.max(0, row.overdueActiveJobs - 1) * 5;
  return Math.max(0, Math.round(utilScore * 0.5 + onTime * 0.5 - overduePenalty));
}

type InspectorInput = {
  id: number;
  employeeNo: string;
  name: string;
  department: { name: string };
};

type AssignmentInput = {
  inspectorId: number;
  status: string;
  allocatedHours: number;
  createdAt: Date;
  job: {
    id: number;
    status: string;
    startDate: Date;
    endDate: Date;
    completedAt: Date | null;
  };
};

type ActivityLogInput = {
  inspectorId: number;
  logDate: Date;
  hours: number;
};

type LeaveInput = {
  inspectorId: number;
  startDate: Date;
  endDate: Date;
  status: string;
};

type OverdueAssignmentInput = {
  inspectorId: number;
  status: string;
  job: {
    id: number;
    ref: string;
    title: string;
    status: string;
    endDate: Date;
    completedAt: Date | null;
    client: { name: string };
    department: { name: string };
  };
  inspector: {
    id: number;
    name: string;
  };
};

export function performanceMethodology() {
  return {
    benchmarks: PERFORMANCE_BENCHMARKS,
    rules: [
      'Billable utilization = logged hours ÷ (available business days × 8h), excluding approved leave.',
      `Target utilization band: ${PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MIN}–${PERFORMANCE_BENCHMARKS.UTILIZATION_TARGET_MAX}% (field-services standard).`,
      `Schedule adherence uses on-time + early closes; needs ≥${PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE} completed jobs before it affects under/over bands.`,
      `Underperforming requires ≥2 sustained signals (low util, poor on-time %, chronic lateness, or chronic overdue) — not a single delayed job.`,
      `Overperforming requires target utilization (or top quartile), zero chronic overdue, and ≥${PERFORMANCE_BENCHMARKS.ON_TIME_TARGET - 3}% on-time when sample size is sufficient.`,
      `Fully engaged = ≥${PERFORMANCE_BENCHMARKS.FULL_ENGAGEMENT_UTIL}% utilization and ≥${PERFORMANCE_BENCHMARKS.FULL_ENGAGEMENT_MIN_DAYS} work days logged.`,
    ],
  };
}

export function buildInspectorPerformanceReport(params: {
  inspectors: InspectorInput[];
  assignments: AssignmentInput[];
  activityLogs: ActivityLogInput[];
  leaveRecords: LeaveInput[];
  periodStart: string;
  periodEnd: string;
  asOf?: Date;
}) {
  const { inspectors, assignments, activityLogs, leaveRecords, periodStart, periodEnd } = params;
  const today = toDateOnly(params.asOf ?? new Date());
  const businessDays = businessDaysBetween(periodStart, periodEnd);

  const drafts = inspectors.map((ins) => {
    const insAssignments = assignments.filter((a) => a.inspectorId === ins.id);
    const insLogs = activityLogs.filter(
      (l) =>
        l.inspectorId === ins.id &&
        toDateOnly(l.logDate) >= periodStart &&
        toDateOnly(l.logDate) <= periodEnd
    );
    const leaveDays = new Set<string>();
    for (const leave of leaveRecords.filter((l) => l.inspectorId === ins.id)) {
      if (!['Approved'].includes(leave.status)) continue;
      const start = toDateOnly(leave.startDate);
      const end = toDateOnly(leave.endDate);
      for (let i = 0; i <= dayDiff(start, end); i += 1) {
        const d = new Date(start + 'T12:00:00');
        d.setDate(d.getDate() + i);
        const iso = toDateOnly(d);
        if (iso >= periodStart && iso <= periodEnd) leaveDays.add(iso);
      }
    }

    const loggedHours = insLogs.reduce((sum, l) => sum + l.hours, 0);
    const workDaysLogged = new Set(insLogs.map((l) => toDateOnly(l.logDate))).size;
    const availableDays = Math.max(1, businessDays - leaveDays.size);
    const capacityHours = availableDays * STANDARD_DAY_HOURS;
    const utilizationPct = Math.round((loggedHours / capacityHours) * 100);

    const periodAssignments = insAssignments.filter((a) =>
      overlapsPeriod(a.job.startDate, a.job.endDate, periodStart, periodEnd)
    );
    const allocatedHours = periodAssignments.reduce((sum, a) => sum + a.allocatedHours, 0);

    const activeJobs = insAssignments.filter(
      (a) =>
        ['Active', 'PendingAcceptance'].includes(a.job.status) &&
        ['Accepted', 'Active', 'PendingAcceptance'].includes(a.status)
    ).length;

    const completedInPeriod = insAssignments.filter(
      (a) =>
        ['Completed', 'Closed'].includes(a.job.status) &&
        a.job.completedAt &&
        toDateOnly(a.job.completedAt) >= periodStart &&
        toDateOnly(a.job.completedAt) <= periodEnd
    );

    let earlyCompletions = 0;
    let onTimeCompletions = 0;
    let lateCompletions = 0;
    for (const a of completedInPeriod) {
      const timing = completionTiming(a.job.completedAt!, a.job.endDate);
      if (timing === 'early') earlyCompletions += 1;
      else if (timing === 'on_time') onTimeCompletions += 1;
      else lateCompletions += 1;
    }

    const completedJobs = completedInPeriod.length;
    const onTimeRatePct =
      completedJobs > 0
        ? Math.round(((earlyCompletions + onTimeCompletions) / completedJobs) * 100)
        : null;

    const overdueActive = insAssignments.filter(
      (a) =>
        ['Active', 'PendingAcceptance'].includes(a.job.status) &&
        ['Accepted', 'Active', 'PendingAcceptance'].includes(a.status) &&
        today > toDateOnly(a.job.endDate)
    );
    const overdueDays = overdueActive.map((a) => dayDiff(toDateOnly(a.job.endDate), today));
    const maxOverdueDays = overdueDays.length > 0 ? Math.max(...overdueDays) : 0;
    const chronicOverdueJobs = overdueDays.filter(
      (d) => d >= PERFORMANCE_BENCHMARKS.CHRONIC_OVERDUE_DAYS
    ).length;
    const overdueActiveJobs = overdueActive.length;

    const assignmentsInPeriod = insAssignments.filter(
      (a) => toDateOnly(a.createdAt) >= periodStart && toDateOnly(a.createdAt) <= periodEnd
    );
    const assignmentsAccepted = assignmentsInPeriod.filter((a) =>
      ['Accepted', 'Active', 'Complete'].includes(a.status)
    ).length;
    const assignmentsRejected = assignmentsInPeriod.filter((a) => a.status === 'Rejected').length;
    const assignmentTotal = assignmentsAccepted + assignmentsRejected;
    const acceptanceRatePct =
      assignmentTotal > 0 ? Math.round((assignmentsAccepted / assignmentTotal) * 100) : null;

    const fullyEngaged =
      utilizationPct >= PERFORMANCE_BENCHMARKS.FULL_ENGAGEMENT_UTIL &&
      workDaysLogged >=
        Math.min(PERFORMANCE_BENCHMARKS.FULL_ENGAGEMENT_MIN_DAYS, Math.max(1, availableDays - 2));

    return {
      id: ins.id,
      employeeNo: ins.employeeNo,
      name: ins.name,
      department: ins.department.name.replace(' Inspection', ''),
      utilizationPct,
      loggedHours: Math.round(loggedHours * 10) / 10,
      allocatedHours,
      workDaysLogged,
      businessDays: availableDays,
      fullyEngaged,
      activeJobs,
      completedJobs,
      onTimeCompletions,
      earlyCompletions,
      lateCompletions,
      onTimeRatePct,
      overdueActiveJobs,
      chronicOverdueJobs,
      maxOverdueDays,
      acceptanceRatePct,
      assignmentsAccepted,
      assignmentsRejected,
    };
  });

  const ratedUtils = drafts
    .filter(
      (d) =>
        d.workDaysLogged >= PERFORMANCE_BENCHMARKS.MIN_WORK_DAYS_FOR_RATING ||
        d.loggedHours >= PERFORMANCE_BENCHMARKS.MIN_LOGGED_HOURS_FOR_RATING
    )
    .map((d) => d.utilizationPct);
  const teamMedianUtilization = percentile(ratedUtils, 50);
  const teamP75Utilization = percentile(ratedUtils, 75);

  const rows: InspectorPerformanceRow[] = drafts.map((base) => {
    const hasRatingData = hasMinimumExposure({
      utilizationPct: base.utilizationPct,
      onTimeRatePct: base.onTimeRatePct,
      completedJobs: base.completedJobs,
      lateCompletions: base.lateCompletions,
      overdueActiveJobs: base.overdueActiveJobs,
      chronicOverdueJobs: base.chronicOverdueJobs,
      maxOverdueDays: base.maxOverdueDays,
      workDaysLogged: base.workDaysLogged,
      loggedHours: base.loggedHours,
      availableDays: base.businessDays,
      fullyEngaged: base.fullyEngaged,
      teamMedianUtilization,
      teamP75Utilization,
    });

    const { band, reason: bandReason } = classifyBand({
      utilizationPct: base.utilizationPct,
      onTimeRatePct: base.onTimeRatePct,
      completedJobs: base.completedJobs,
      lateCompletions: base.lateCompletions,
      overdueActiveJobs: base.overdueActiveJobs,
      chronicOverdueJobs: base.chronicOverdueJobs,
      maxOverdueDays: base.maxOverdueDays,
      workDaysLogged: base.workDaysLogged,
      loggedHours: base.loggedHours,
      availableDays: base.businessDays,
      fullyEngaged: base.fullyEngaged,
      teamMedianUtilization,
      teamP75Utilization,
    });

    const score = performanceScore({
      utilizationPct: base.utilizationPct,
      onTimeRatePct: base.onTimeRatePct,
      chronicOverdueJobs: base.chronicOverdueJobs,
      overdueActiveJobs: base.overdueActiveJobs,
      completedJobs: base.completedJobs,
    });

    const highlights = buildHighlights({ ...base, hasRatingData });

    return { ...base, band, bandReason, hasRatingData, score, highlights };
  });

  rows.sort((a, b) => b.score - a.score);

  const withCompleted = rows.filter(
    (r) => r.completedJobs >= PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE
  );
  const avgUtilization =
    rows.length > 0 ? Math.round(rows.reduce((s, r) => s + r.utilizationPct, 0) / rows.length) : 0;
  const avgOnTime =
    withCompleted.length > 0
      ? Math.round(withCompleted.reduce((s, r) => s + (r.onTimeRatePct ?? 0), 0) / withCompleted.length)
      : null;
  const acceptanceRows = rows.filter((r) => r.acceptanceRatePct !== null);
  const avgAcceptance =
    acceptanceRows.length > 0
      ? Math.round(acceptanceRows.reduce((s, r) => s + (r.acceptanceRatePct ?? 0), 0) / acceptanceRows.length)
      : null;
  const fullyEngagedCount = rows.filter((r) => r.fullyEngaged).length;

  return {
    period: { start: periodStart, end: periodEnd, businessDays },
    methodology: performanceMethodology(),
    scorecard: {
      avgUtilization,
      avgOnTime,
      avgAcceptance,
      fullyEngagedCount,
      inspectorCount: rows.length,
      overperformingCount: rows.filter((r) => r.band === 'overperforming').length,
      underperformingCount: rows.filter((r) => r.band === 'underperforming').length,
      atRiskCount: rows.filter((r) => r.band === 'at_risk').length,
    },
    inspectors: rows,
    overperforming: rows.filter((r) => r.band === 'overperforming'),
    underperforming: rows.filter((r) => r.band === 'underperforming'),
    atRisk: rows.filter((r) => r.band === 'at_risk'),
    onTimeFinishers: rows.filter(
      (r) =>
        r.onTimeRatePct === 100 &&
        r.completedJobs >= PERFORMANCE_BENCHMARKS.MIN_COMPLETED_FOR_SCHEDULE
    ),
    fullyEngaged: rows.filter((r) => r.fullyEngaged),
  };
}

export function defaultReportPeriod(asOf = new Date()) {
  const start = new Date(asOf.getFullYear(), asOf.getMonth(), 1);
  const end = new Date(asOf.getFullYear(), asOf.getMonth() + 1, 0);
  return {
    periodStart: toDateOnly(start),
    periodEnd: toDateOnly(end),
  };
}

function mondayOf(iso: string) {
  const d = new Date(iso + 'T12:00:00');
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateOnly(d);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return toDateOnly(d);
}

function weekBuckets(periodStart: string, periodEnd: string) {
  const buckets: { start: string; end: string; label: string }[] = [];
  let cursor = mondayOf(periodStart);
  while (cursor <= periodEnd) {
    const weekEnd = addDays(cursor, 6);
    const start = cursor < periodStart ? periodStart : cursor;
    const end = weekEnd > periodEnd ? periodEnd : weekEnd;
    if (start <= end) {
      const labelStart = new Date(start + 'T12:00:00');
      buckets.push({
        start,
        end,
        label: labelStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      });
    }
    cursor = addDays(cursor, 7);
  }
  return buckets;
}

export type ProductivityTrendPoint = {
  start: string;
  end: string;
  label: string;
  utilizationPct: number;
  onTimeRatePct: number | null;
  overdueCount: number;
  completedJobs: number;
};

export function buildProductivityTrend(params: {
  inspectors: InspectorInput[];
  assignments: AssignmentInput[];
  activityLogs: ActivityLogInput[];
  leaveRecords: LeaveInput[];
  periodStart: string;
  periodEnd: string;
  asOf?: Date;
}): ProductivityTrendPoint[] {
  const today = toDateOnly(params.asOf ?? new Date());
  return weekBuckets(params.periodStart, params.periodEnd).map((week) => {
    const asOf = today < week.end ? today : week.end;
    let loggedHours = 0;
    let capacityHours = 0;
    let completedJobs = 0;
    let onTimeOrEarly = 0;
    let overdueCount = 0;

    for (const ins of params.inspectors) {
      const leaveDays = new Set<string>();
      for (const leave of params.leaveRecords.filter((l) => l.inspectorId === ins.id && l.status === 'Approved')) {
        const start = toDateOnly(leave.startDate);
        const end = toDateOnly(leave.endDate);
        for (let i = 0; i <= dayDiff(start, end); i += 1) {
          const iso = addDays(start, i);
          if (iso >= week.start && iso <= week.end) leaveDays.add(iso);
        }
      }
      const availableDays = Math.max(1, businessDaysBetween(week.start, week.end) - leaveDays.size);
      capacityHours += availableDays * STANDARD_DAY_HOURS;

      loggedHours += params.activityLogs
        .filter(
          (l) =>
            l.inspectorId === ins.id &&
            toDateOnly(l.logDate) >= week.start &&
            toDateOnly(l.logDate) <= week.end
        )
        .reduce((sum, l) => sum + l.hours, 0);

      const insAssignments = params.assignments.filter((a) => a.inspectorId === ins.id);
      for (const a of insAssignments) {
        if (
          ['Completed', 'Closed'].includes(a.job.status) &&
          a.job.completedAt &&
          toDateOnly(a.job.completedAt) >= week.start &&
          toDateOnly(a.job.completedAt) <= week.end
        ) {
          completedJobs += 1;
          const timing = completionTiming(a.job.completedAt, a.job.endDate);
          if (timing !== 'late') onTimeOrEarly += 1;
        }

        const endDate = toDateOnly(a.job.endDate);
        if (endDate < week.start || endDate > week.end) continue;
        if (!['Accepted', 'Active', 'Complete'].includes(a.status)) continue;
        const completedAt = a.job.completedAt ? toDateOnly(a.job.completedAt) : null;
        const lateCompleted = completedAt !== null && completedAt > endDate;
        const activeOverdue = completedAt === null && asOf > endDate && a.job.status === 'Active';
        if (lateCompleted || activeOverdue) overdueCount += 1;
      }
    }

    return {
      start: week.start,
      end: week.end,
      label: week.label,
      utilizationPct: capacityHours > 0 ? Math.round((loggedHours / capacityHours) * 100) : 0,
      onTimeRatePct: completedJobs > 0 ? Math.round((onTimeOrEarly / completedJobs) * 100) : null,
      overdueCount,
      completedJobs,
    };
  });
}

export type OverdueTrendPoint = {
  start: string;
  end: string;
  label: string;
  total: number;
  activeOverdue: number;
  lateCompleted: number;
};

export function buildOverdueTrend(params: {
  assignments: OverdueAssignmentInput[];
  periodStart: string;
  periodEnd: string;
  asOf?: Date;
}): OverdueTrendPoint[] {
  const today = toDateOnly(params.asOf ?? new Date());
  return weekBuckets(params.periodStart, params.periodEnd).map((week) => {
    const asOf = today < week.end ? today : week.end;
    let activeOverdue = 0;
    let lateCompleted = 0;

    for (const assignment of params.assignments) {
      const endDate = toDateOnly(assignment.job.endDate);
      if (endDate < week.start || endDate > week.end) continue;
      if (!['Accepted', 'Active', 'Complete', 'Approved'].includes(assignment.status)) continue;

      const completedAt = assignment.job.completedAt ? toDateOnly(assignment.job.completedAt) : null;
      if (completedAt !== null && completedAt > endDate) lateCompleted += 1;
      else if (completedAt === null && asOf > endDate) activeOverdue += 1;
    }

    return {
      start: week.start,
      end: week.end,
      label: week.label,
      total: activeOverdue + lateCompleted,
      activeOverdue,
      lateCompleted,
    };
  });
}

export function buildOverdueJobsReport(params: {
  assignments: OverdueAssignmentInput[];
  periodStart: string;
  periodEnd: string;
  asOf?: Date;
}) {
  const periodRef = params.asOf ? toDateOnly(params.asOf) : toDateOnly(new Date());
  const asOf = periodRef < params.periodEnd ? periodRef : params.periodEnd;

  const items: OverdueJobRow[] = [];
  for (const assignment of params.assignments) {
    const endDate = toDateOnly(assignment.job.endDate);
    if (endDate < params.periodStart || endDate > params.periodEnd) continue;
    if (!['Accepted', 'Active', 'Complete', 'Approved'].includes(assignment.status)) continue;

    const completedAt = assignment.job.completedAt ? toDateOnly(assignment.job.completedAt) : null;
    const isLateCompleted = completedAt !== null && completedAt > endDate;
    const isActiveOverdue = completedAt === null && asOf > endDate;

    if (!isLateCompleted && !isActiveOverdue) continue;

    const daysLate = isLateCompleted ? dayDiff(endDate, completedAt!) : dayDiff(endDate, asOf);
    items.push({
      jobId: assignment.job.id,
      ref: assignment.job.ref,
      title: assignment.job.title,
      client: assignment.job.client.name,
      department: assignment.job.department.name.replace(' Inspection', ''),
      inspectorId: assignment.inspector.id,
      inspectorName: assignment.inspector.name,
      plannedEnd: endDate,
      completedAt,
      daysLate: Math.max(1, daysLate),
      status: assignment.job.status,
      overdueType: isLateCompleted ? 'late_completed' : 'active_overdue',
    });
  }

  items.sort((a, b) => b.daysLate - a.daysLate || a.plannedEnd.localeCompare(b.plannedEnd));
  return {
    total: items.length,
    activeOverdue: items.filter((i) => i.overdueType === 'active_overdue').length,
    lateCompleted: items.filter((i) => i.overdueType === 'late_completed').length,
    items,
  };
}
