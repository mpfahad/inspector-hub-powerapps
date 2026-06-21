/**
 * Skill-Based Assignment Engine — ported from lovable-source/src/lib/competency.ts
 * PowerFx: implement scoring in a collection built with ForAll + Patch; hard blocks via If() before Patch.
 */

export type CertStatus = 'Valid' | 'Expiring Soon' | 'Expired' | 'Missing';

export type Certification = {
  code: string;
  name: string;
  body: string;
  category: string;
  validityMonths: number;
};

export const CERT_CATALOG: Certification[] = [
  { code: 'API 510', name: 'Pressure Vessel Inspector', body: 'API', category: 'Pressure', validityMonths: 36 },
  { code: 'API 570', name: 'Piping Inspector', body: 'API', category: 'Piping', validityMonths: 36 },
  { code: 'API 653', name: 'Aboveground Storage Tank Inspector', body: 'API', category: 'Tank', validityMonths: 36 },
  { code: 'CSWIP 3.1', name: 'Welding Inspector', body: 'TWI', category: 'Welding', validityMonths: 60 },
  { code: 'NDT L-II PAUT', name: 'PAUT Level II', body: 'PCN', category: 'NDT', validityMonths: 60 },
  { code: 'NDT L-II UT', name: 'Ultrasonic Level II', body: 'ASNT', category: 'NDT', validityMonths: 36 },
  { code: 'NDT L-II RT', name: 'Radiography Level II', body: 'ASNT', category: 'NDT', validityMonths: 36 },
  { code: 'NEBOSH IGC', name: 'HSE General Certificate', body: 'NEBOSH', category: 'HSE', validityMonths: 0 },
  { code: 'OSHA 30', name: 'Construction Safety', body: 'OSHA', category: 'HSE', validityMonths: 60 },
];

export type InspectorProfile = {
  id: string;
  inspectorId: number;
  name: string;
  dept: string;
  location: string;
  yearsExperience: number;
  workloadHrs: number;
  capacityHrs: number;
  status: 'Available' | 'On Job' | 'On Leave' | 'In Training';
  certs: { code: string; expires: string }[];
};

const TODAY = new Date('2026-06-13');

export const COMPETENCY: InspectorProfile[] = [
  { id: 'E-1042', inspectorId: 1, name: 'Daniel Okafor', dept: 'Mechanical', location: 'Houston, TX', yearsExperience: 12, workloadHrs: 34, capacityHrs: 40, status: 'On Job', certs: [{ code: 'API 510', expires: '2027-08-08' }, { code: 'CSWIP 3.1', expires: '2028-12-01' }] },
  { id: 'E-1058', inspectorId: 2, name: 'Mei Lin', dept: 'NDT', location: 'San Diego, CA', yearsExperience: 8, workloadHrs: 22, capacityHrs: 40, status: 'Available', certs: [{ code: 'NDT L-II PAUT', expires: '2026-08-27' }, { code: 'NDT L-II UT', expires: '2027-02-14' }] },
  { id: 'E-1077', inspectorId: 3, name: 'Carlos Ibañez', dept: 'Electrical', location: 'Phoenix, AZ', yearsExperience: 6, workloadHrs: 38, capacityHrs: 40, status: 'On Job', certs: [{ code: 'CSWIP 3.1', expires: '2029-05-20' }] },
  { id: 'E-1083', inspectorId: 4, name: 'Aisha Rahman', dept: 'Civil', location: 'Dallas, TX', yearsExperience: 10, workloadHrs: 0, capacityHrs: 40, status: 'On Leave', certs: [{ code: 'NEBOSH IGC', expires: '2099-01-01' }] },
  { id: 'E-1096', inspectorId: 5, name: 'Henrik Sørensen', dept: 'HSE', location: 'Anchorage, AK', yearsExperience: 14, workloadHrs: 18, capacityHrs: 40, status: 'Available', certs: [{ code: 'NEBOSH IGC', expires: '2099-01-01' }, { code: 'OSHA 30', expires: '2027-11-15' }] },
  { id: 'E-1119', inspectorId: 6, name: 'Olivia Brennan', dept: 'NDT', location: 'New Orleans, LA', yearsExperience: 11, workloadHrs: 30, capacityHrs: 40, status: 'On Job', certs: [{ code: 'NDT L-II RT', expires: '2026-08-02' }, { code: 'NDT L-II PAUT', expires: '2028-03-10' }] },
  { id: 'E-1132', inspectorId: 7, name: 'Rafael Mendes', dept: 'Civil', location: 'Miami, FL', yearsExperience: 7, workloadHrs: 24, capacityHrs: 40, status: 'Available', certs: [{ code: 'API 653', expires: '2027-03-22' }, { code: 'OSHA 30', expires: '2026-11-20' }] },
];

export type JobSpec = {
  id: string;
  jobId: number;
  title: string;
  dept: string;
  location: string;
  requiredCerts: string[];
  preferredCerts?: string[];
  minExperience?: number;
  estimatedHrs: number;
};

export const DEMO_JOB: JobSpec = {
  id: 'J-2026-00187',
  jobId: 3,
  title: 'Phased Array UT — Pipeline 4B',
  dept: 'NDT',
  location: 'New Orleans, LA',
  requiredCerts: ['NDT L-II PAUT', 'NDT L-II UT'],
  preferredCerts: ['NDT L-III'],
  minExperience: 5,
  estimatedHrs: 40,
};

export function certStatus(expires: string): CertStatus {
  const daysLeft = Math.round((new Date(expires).getTime() - TODAY.getTime()) / 86400000);
  if (daysLeft < 0) return 'Expired';
  if (daysLeft <= 90) return 'Expiring Soon';
  return 'Valid';
}

export type MatchResult = {
  inspector: InspectorProfile;
  score: number;
  blocked: boolean;
  blockReasons: string[];
  warnings: string[];
  breakdown: { department: number; certifications: number; qualifications: number; availability: number; workload: number; proximity: number };
};

/** PowerFx: ForAll(Inspectors, Patch(colRanked, ThisRecord, { score: ... })) then Sort(colRanked, score, Descending) */
export function matchInspector(job: JobSpec, ins: InspectorProfile): MatchResult {
  const blockReasons: string[] = [];
  const warnings: string[] = [];
  const certMap = new Map(ins.certs.map((c) => [c.code, c]));

  if (ins.status === 'On Leave') blockReasons.push('On leave during job window');
  if (ins.status === 'In Training') blockReasons.push('Currently in training');

  for (const req of job.requiredCerts) {
    const c = certMap.get(req);
    if (!c) blockReasons.push(`Missing required: ${req}`);
    else if (certStatus(c.expires) === 'Expired') blockReasons.push(`Expired: ${req}`);
    else if (certStatus(c.expires) === 'Expiring Soon') warnings.push(`${req} expiring soon`);
  }

  const util = ins.capacityHrs ? ins.workloadHrs / ins.capacityHrs : 0;
  if (util > 0.95) blockReasons.push('Fully allocated this week');

  const department = ins.dept === job.dept ? 20 : 6;
  const requiredHeld = job.requiredCerts.filter((r) => {
    const c = certMap.get(r);
    return c && certStatus(c.expires) !== 'Expired';
  }).length;
  const certifications = job.requiredCerts.length ? Math.round((requiredHeld / job.requiredCerts.length) * 35) : 35;
  const qualifications = Math.min(15, Math.round(ins.yearsExperience * 1.5));
  const availability = ins.status === 'Available' ? 15 : ins.status === 'On Job' ? 9 : 0;
  const workload = Math.round(Math.max(0, 10 - util * 10));
  const proximity = ins.location.split(',')[1]?.trim() === job.location.split(',')[1]?.trim() ? 5 : 2;
  const breakdown = { department, certifications, qualifications, availability, workload, proximity };
  const score = department + certifications + qualifications + availability + workload + proximity;

  return { inspector: ins, score, blocked: blockReasons.length > 0, blockReasons, warnings, breakdown };
}

export function rankCandidates(job: JobSpec, pool: InspectorProfile[] = COMPETENCY): MatchResult[] {
  return pool.map((p) => matchInspector(job, p)).sort((a, b) => {
    if (a.blocked !== b.blocked) return a.blocked ? 1 : -1;
    return b.score - a.score;
  });
}

export function competencyStats() {
  const expiringList = COMPETENCY.flatMap((i) =>
    i.certs
      .filter((c) => certStatus(c.expires) === 'Expiring Soon' || certStatus(c.expires) === 'Expired')
      .map((c) => ({ inspector: i.name, dept: i.dept, code: c.code, status: certStatus(c.expires) }))
  );
  return { expiringList, catalogSize: CERT_CATALOG.length, workforce: COMPETENCY.length };
}
