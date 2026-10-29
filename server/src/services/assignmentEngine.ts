import type { Certification, Inspector, InspectorCert, Job, JobCertRequirement, LeaveRequest } from '@prisma/client';
import { certStatusFromExpiry } from '../lib/certStatus.js';
import { isSameArea, type GeoPoint } from '../lib/geo.js';

export type InspectorWithCerts = Inspector & {
  inspectorCerts: (InspectorCert & { certification: Certification })[];
};

export type JobWithReqs = Job & {
  certRequirements: (JobCertRequirement & { certification: Certification })[];
  client?: GeoPoint | null;
};

export type OverlappingAssignment = {
  inspectorId: number;
  job: {
    id: number;
    ref: string;
    location: string | null;
    latitude: number | null;
    longitude: number | null;
    startDate: Date;
    endDate: Date;
    client?: GeoPoint | null;
  };
};

function certStatus(expiresOn: Date): 'Valid' | 'ExpiringSoon' | 'Expired' {
  return certStatusFromExpiry(expiresOn);
}

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

export type ProposalResult = {
  inspectorId: number;
  inspectorName: string;
  score: number;
  rank: number;
  blocked: boolean;
  blockReasons: string[];
  warnings: string[];
};

export async function rankInspectorsForJob(
  job: JobWithReqs,
  inspectors: InspectorWithCerts[],
  leaveRequests: LeaveRequest[],
  workloadByInspector: Map<number, number>,
  overlappingAssignments: OverlappingAssignment[] = []
): Promise<ProposalResult[]> {
  const mandatoryCertIds = job.certRequirements.filter((r) => r.mandatory).map((r) => r.certificationId);
  const jobPoint: GeoPoint = {
    latitude: job.latitude,
    longitude: job.longitude,
    location: job.location,
  };
  const jobClient = job.client ?? null;

  const results = inspectors.map((ins) => {
    const blockReasons: string[] = [];
    const warnings: string[] = [];

    if (ins.status === 'OnLeave') blockReasons.push('On leave');
    if (ins.status === 'Training') blockReasons.push('In training');
    if (ins.status === 'Inactive') blockReasons.push('Inactive');
    if (job.requiresQeApproval && !ins.qeApproved) {
      blockReasons.push('Not QE-approved (required for this job)');
    }

    const onLeave = leaveRequests.some(
      (l) =>
        l.inspectorId === ins.id &&
        l.status === 'Approved' &&
        overlaps(l.startDate, l.endDate, job.startDate, job.endDate)
    );
    if (onLeave) blockReasons.push('Leave overlaps job window');

    const certMap = new Map(ins.inspectorCerts.map((c) => [c.certificationId, c]));
    for (const certId of mandatoryCertIds) {
      const held = certMap.get(certId);
      const cert = job.certRequirements.find((r) => r.certificationId === certId)?.certification;
      if (!held) blockReasons.push(`Missing ${cert?.code ?? 'cert'}`);
      else if (certStatus(held.expiresOn) === 'Expired') blockReasons.push(`Expired ${cert?.code}`);
      else if (certStatus(held.expiresOn) === 'ExpiringSoon') warnings.push(`${cert?.code} expiring soon`);
    }

    const workload = workloadByInspector.get(ins.id) ?? 0;
    const util = ins.weeklyCapacityHrs ? workload / ins.weeklyCapacityHrs : 0;
    if (util > 0.95) blockReasons.push('Fully allocated this week');
    else if (util > 0.85) warnings.push(`Heavy workload (${Math.round(util * 100)}%)`);

    const areaJobs = overlappingAssignments.filter(
      (a) =>
        a.inspectorId === ins.id &&
        a.job.id !== job.id &&
        overlaps(a.job.startDate, a.job.endDate, job.startDate, job.endDate) &&
        isSameArea(jobPoint, jobClient, a.job, a.job.client)
    );
    if (areaJobs.length > 0) {
      const refs = areaJobs.map((a) => a.job.ref).join(', ');
      warnings.push(`Already assigned in this area (${refs})`);
    }

    const department = ins.departmentId === job.departmentId ? 20 : 6;
    const requiredHeld = mandatoryCertIds.filter((id) => {
      const c = certMap.get(id);
      return c && certStatus(c.expiresOn) !== 'Expired';
    }).length;
    const certifications = mandatoryCertIds.length
      ? Math.round((requiredHeld / mandatoryCertIds.length) * 35)
      : 35;
    const qualifications = Math.min(15, Math.round(ins.yearsExperience * 1.5));
    const availability = ins.status === 'Active' ? 15 : 8;
    const workloadScore = Math.round(Math.max(0, 10 - util * 10));
    const proximity = 2;
    const score = department + certifications + qualifications + availability + workloadScore + proximity;

    return {
      inspectorId: ins.id,
      inspectorName: ins.name,
      score,
      rank: 0,
      blocked: blockReasons.length > 0,
      blockReasons,
      warnings,
    };
  });

  const sorted = results.sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
    return b.score - a.score;
  });

  return sorted.map((r, i) => ({ ...r, rank: i + 1 }));
}
