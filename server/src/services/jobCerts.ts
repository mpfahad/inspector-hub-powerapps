import type { Certification, InspectorCert, JobCertRequirement, JobTypeCertRequirement } from '@prisma/client';
import { certStatusFromExpiry } from '../lib/certStatus.js';

export type CertMatch = 'holds' | 'missing' | 'expiring' | 'expired' | 'unassigned';

export type JobCertSummaryItem = {
  certificationId: number;
  code: string;
  name: string;
  mandatory: boolean;
  match: CertMatch;
};

export type JobCertSummary = {
  items: JobCertSummaryItem[];
  missingCount: number;
  expiringCount: number;
  expiredCount: number;
};

type ReqRow = {
  certificationId: number;
  mandatory: boolean;
  certification: Pick<Certification, 'id' | 'code' | 'name'>;
};

type HeldCert = Pick<InspectorCert, 'certificationId' | 'expiresOn'>;

function mergeRequirements(
  jobReqs: ReqRow[] | undefined,
  typeReqs: ReqRow[] | undefined
): ReqRow[] {
  if (jobReqs && jobReqs.length > 0) return jobReqs;
  return typeReqs ?? [];
}

export function buildJobCertSummary(input: {
  jobRequirements?: (JobCertRequirement & { certification: Pick<Certification, 'id' | 'code' | 'name'> })[];
  jobTypeRequirements?: (JobTypeCertRequirement & { certification: Pick<Certification, 'id' | 'code' | 'name'> })[];
  inspectorCerts?: HeldCert[] | null;
  assigned: boolean;
}): JobCertSummary {
  const reqs = mergeRequirements(input.jobRequirements, input.jobTypeRequirements);
  const certMap = new Map((input.inspectorCerts ?? []).map((c) => [c.certificationId, c]));

  const items: JobCertSummaryItem[] = reqs.map((r) => {
    const base = {
      certificationId: r.certificationId,
      code: r.certification.code,
      name: r.certification.name,
      mandatory: r.mandatory,
    };
    if (!input.assigned) {
      return { ...base, match: 'unassigned' as const };
    }
    const held = certMap.get(r.certificationId);
    if (!held) return { ...base, match: 'missing' as const };
    const status = certStatusFromExpiry(held.expiresOn);
    if (status === 'Expired') return { ...base, match: 'expired' as const };
    if (status === 'ExpiringSoon') return { ...base, match: 'expiring' as const };
    return { ...base, match: 'holds' as const };
  });

  return {
    items,
    missingCount: items.filter((i) => i.match === 'missing' || i.match === 'expired').length,
    expiringCount: items.filter((i) => i.match === 'expiring').length,
    expiredCount: items.filter((i) => i.match === 'expired').length,
  };
}

const OPEN_ASSIGNMENT = ['Proposed', 'PendingAcceptance', 'Accepted', 'Active'];

export function certSummaryForJob(job: {
  certRequirements?: (JobCertRequirement & { certification: Pick<Certification, 'id' | 'code' | 'name'> })[];
  jobType?: {
    certRequirements?: (JobTypeCertRequirement & { certification: Pick<Certification, 'id' | 'code' | 'name'> })[];
  } | null;
  assignments?: {
    status: string;
    inspector?: { inspectorCerts?: HeldCert[] } | null;
  }[];
}): JobCertSummary {
  const open = (job.assignments ?? []).find((a) => OPEN_ASSIGNMENT.includes(a.status));
  return buildJobCertSummary({
    jobRequirements: job.certRequirements,
    jobTypeRequirements: job.jobType?.certRequirements,
    inspectorCerts: open?.inspector?.inspectorCerts ?? null,
    assigned: Boolean(open),
  });
}
