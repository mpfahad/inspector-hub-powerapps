import { prisma } from '../lib/prisma.js';
import { certStatusFromExpiry } from '../lib/certStatus.js';
import { isSameArea, type GeoPoint } from '../lib/geo.js';
import { assignmentWindow } from './jobWorkflow.js';

export type AssignBand = 'ready' | 'caution' | 'busy';

export type AssignCandidate = {
  id: number;
  employeeNo: string;
  name: string;
  email?: string | null;
  jobTitle?: string | null;
  status: string;
  qeApproved: boolean;
  department: { id: number; name: string; code: string };
  band: AssignBand;
  reasons: string[];
  crossDept: boolean;
  qeOk: boolean;
  certsOk: boolean;
  onLeave: boolean;
  busy: boolean;
  selectable: boolean;
};

function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date) {
  return aStart <= bEnd && bStart <= aEnd;
}

/** Job-scoped fitness for the manual assign modal (status colours, not ranking). */
export async function listAssignCandidates(jobId: number): Promise<AssignCandidate[]> {
  const job = await prisma.job.findUnique({
    where: { id: jobId },
    include: {
      client: true,
      certRequirements: { include: { certification: true } },
      jobType: { include: { certRequirements: { include: { certification: true } } } },
    },
  });
  if (!job) throw new Error('Job not found');

  let certReqs = job.certRequirements;
  if (certReqs.length === 0 && job.jobType?.certRequirements.length) {
    certReqs = job.jobType.certRequirements.map((r) => ({
      ...r,
      jobId,
      id: 0,
    }));
  }
  const mandatory = certReqs.filter((r) => r.mandatory);

  const [inspectors, leaveRequests, activeAssignments] = await Promise.all([
    prisma.inspector.findMany({
      where: { status: { not: 'Inactive' } },
      include: {
        department: true,
        inspectorCerts: { include: { certification: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.leaveRequest.findMany({ where: { status: 'Approved' } }),
    prisma.assignment.findMany({
      where: {
        status: { in: ['Accepted', 'Active', 'PendingAcceptance', 'Proposed'] },
        jobId: { not: jobId },
      },
      include: { job: { include: { client: true } } },
    }),
  ]);

  const jobPoint: GeoPoint = {
    latitude: job.latitude,
    longitude: job.longitude,
    location: job.location,
  };

  const rows: AssignCandidate[] = inspectors.map((ins) => {
    const reasons: string[] = [];
    const crossDept = ins.departmentId !== job.departmentId;
    const qeOk = !job.requiresQeApproval || ins.qeApproved;

    if (ins.status === 'OnLeave') reasons.push('On leave');
    if (ins.status === 'Training') reasons.push('In training');

    const onLeave = leaveRequests.some(
      (l) =>
        l.inspectorId === ins.id &&
        overlaps(l.startDate, l.endDate, job.startDate, job.endDate)
    );
    if (onLeave) reasons.push('Leave overlaps job window');

    const certMap = new Map(ins.inspectorCerts.map((c) => [c.certificationId, c]));
    let certsOk = true;
    let certExpiring = false;
    for (const req of mandatory) {
      const held = certMap.get(req.certificationId);
      const code = req.certification.code;
      if (!held) {
        certsOk = false;
        reasons.push(`Missing ${code}`);
      } else {
        const st = certStatusFromExpiry(held.expiresOn);
        if (st === 'Expired') {
          certsOk = false;
          reasons.push(`Expired ${code}`);
        } else if (st === 'ExpiringSoon') {
          certExpiring = true;
          reasons.push(`${code} expiring soon`);
        }
      }
    }

    const overlapping = activeAssignments.filter((a) => {
      if (a.inspectorId !== ins.id) return false;
      if (!['Accepted', 'Active', 'PendingAcceptance'].includes(a.status)) return false;
      const win = assignmentWindow(a, a.job);
      return overlaps(win.start, win.end, job.startDate, job.endDate);
    });
    const busyOverlap = overlapping.length > 0;
    if (busyOverlap) {
      const refs = overlapping.map((a) => a.job.ref).join(', ');
      reasons.push(`Already assigned (${refs})`);
    }

    const sameAreaBusy = overlapping.filter((a) =>
      isSameArea(jobPoint, job.client, a.job, a.job.client)
    );
    if (sameAreaBusy.length > 0 && !busyOverlap) {
      /* already covered */
    }

    if (crossDept) reasons.push(`Other department · ${ins.department.name}`);
    if (job.requiresQeApproval && !ins.qeApproved) reasons.push('Not QE-approved');

    const statusBusy =
      ins.status === 'OnLeave' || ins.status === 'Training' || onLeave || busyOverlap;
    const hardBlock = !certsOk;

    let band: AssignBand;
    if (statusBusy || hardBlock) {
      band = 'busy';
    } else if (crossDept || certExpiring || !qeOk) {
      band = 'caution';
    } else {
      band = 'ready';
    }

    // Dedupe reasons while preserving order
    const uniqueReasons = [...new Set(reasons)];

    return {
      id: ins.id,
      employeeNo: ins.employeeNo,
      name: ins.name,
      email: ins.email,
      jobTitle: ins.jobTitle,
      status: ins.status,
      qeApproved: ins.qeApproved,
      department: {
        id: ins.department.id,
        name: ins.department.name,
        code: ins.department.code,
      },
      band,
      reasons: uniqueReasons,
      crossDept,
      qeOk,
      certsOk,
      onLeave: onLeave || ins.status === 'OnLeave',
      busy: statusBusy,
      selectable: true, // Inactive already filtered; confirmations handled in UI
    };
  });

  const bandOrder: Record<AssignBand, number> = { ready: 0, caution: 1, busy: 2 };
  return rows.sort((a, b) => {
    if (bandOrder[a.band] !== bandOrder[b.band]) return bandOrder[a.band] - bandOrder[b.band];
    if (a.crossDept !== b.crossDept) return a.crossDept ? 1 : -1;
    return a.name.localeCompare(b.name);
  });
}
