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

export function certMatchLabel(match: CertMatch) {
  if (match === 'holds') return 'Holds';
  if (match === 'missing') return 'Missing';
  if (match === 'expiring') return 'Expiring';
  if (match === 'expired') return 'Expired';
  return 'Required';
}

export function certMatchClass(match: CertMatch) {
  if (match === 'holds') return 'bg-teal/10 text-teal';
  if (match === 'missing' || match === 'expired') return 'bg-red-100 text-red-700';
  if (match === 'expiring') return 'bg-amber-100 text-amber-800';
  return 'bg-slate-100 text-slate-600';
}
