/**
 * Import NDT Inspection roster + job types from docs/NDT/*.csv
 * Idempotent upsert — does not wipe other departments.
 *
 * Usage (from server/): npm run db:import-ndt
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient, InspectorStatus, CertStatus } from '@prisma/client';
import { syncJobTypeRates } from '../src/services/jobTypeRates.js';

const prisma = new PrismaClient();

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Prefer prisma/ndt (shipped in Docker image); fall back to docs/NDT. */
function resolveNdtDir() {
  const bundled = path.resolve(__dirname, 'ndt');
  const docs = path.resolve(__dirname, '../../docs/NDT');
  try {
    readFileSync(path.join(bundled, 'Employees.csv'));
    return bundled;
  } catch {
    return docs;
  }
}
const NDT_DIR = resolveNdtDir();
const EMPLOYEES_CSV = path.join(NDT_DIR, 'Employees.csv');
const JOB_TYPES_CSV = path.join(NDT_DIR, 'JobTypes.csv');

const PLACEHOLDER_ISSUED = '2024-01-01';
const NO_EXPIRY = '2099-12-31';

/** Parse RFC4180 CSV including multiline quoted fields. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;
  const s = text.replace(/^\uFEFF/, '');

  while (i < s.length) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i += 1;
        continue;
      }
      field += ch;
      i += 1;
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      i += 1;
      continue;
    }
    if (ch === ',') {
      row.push(field.trim());
      field = '';
      i += 1;
      continue;
    }
    if (ch === '\n' || (ch === '\r' && s[i + 1] === '\n')) {
      row.push(field.trim());
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      i += ch === '\r' ? 2 : 1;
      continue;
    }
    if (ch === '\r') {
      row.push(field.trim());
      field = '';
      if (row.some((c) => c !== '')) rows.push(row);
      row = [];
      i += 1;
      continue;
    }
    field += ch;
    i += 1;
  }
  row.push(field.trim());
  if (row.some((c) => c !== '')) rows.push(row);
  return rows;
}

function parseFlexibleDate(raw: string | undefined | null): Date | null {
  if (!raw) return null;
  const t = raw.trim();
  if (!t || /^no\s*expiry$/i.test(t)) return new Date(`${NO_EXPIRY}T12:00:00`);
  // DD-MMM-YY or DD-MMM-YYYY
  const m = t.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const mon = m[2].slice(0, 1).toUpperCase() + m[2].slice(1).toLowerCase();
    let year = m[3];
    if (year.length === 2) year = `20${year}`;
    const iso = new Date(`${day} ${mon} ${year} 12:00:00 UTC`);
    if (!Number.isNaN(iso.getTime())) return iso;
  }
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) {
    const d = new Date(`${t.slice(0, 10)}T12:00:00`);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return null;
}

function certStatusFor(expiresOn: Date): CertStatus {
  const now = new Date();
  const ms = expiresOn.getTime() - now.getTime();
  const days = ms / 86_400_000;
  if (days < 0) return CertStatus.Expired;
  if (days <= 90) return CertStatus.ExpiringSoon;
  return CertStatus.Valid;
}

function slugCode(name: string): string {
  return name
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

/**
 * Normalize free-text cert names from the employee sheet onto catalog codes
 * used by JobTypes.csv so competency matching works.
 * Level III also grants the Level II code for the same method.
 */
function resolveCertFromName(rawName: string, rawCode?: string): { code: string; name: string; also: string[] } {
  const name = rawName.replace(/\s+/g, ' ').trim();
  const also: string[] = [];
  const lower = name.toLowerCase();

  const levelMatch = lower.match(/\blevel\s*(i{1,3}|\d)\b/);
  const levelNum =
    levelMatch == null
      ? null
      : /iii|3/.test(levelMatch[1])
        ? 3
        : /ii|2/.test(levelMatch[1])
          ? 2
          : 1;

  const method =
    /\b(paut|phased\s*array)\b/.test(lower)
      ? 'PAUT'
      : /\b(ut|ultrasonic)\b/.test(lower)
        ? 'UT'
        : /\b(lpt|pt|penetrant|liquid\s*penetrant)\b/.test(lower)
          ? 'PT'
          : /\b(mpt|mt|magnetic)\b/.test(lower)
            ? 'MT'
            : /\b(rt|radiograph)/.test(lower)
              ? 'RT'
              : /\b(vt|visual)\b/.test(lower)
                ? 'VT'
                : null;

  if (method && levelNum) {
    const code = `NDT-${method}-L${levelNum}`;
    if (levelNum >= 3) also.push(`NDT-${method}-L2`);
    if (levelNum >= 2 && method !== 'VT') {
      /* L2 is the job-type baseline */
    }
    return { code, name, also };
  }

  if (/\birata\b/.test(lower)) {
    if (/\blevel\s*2\b|\bl2\b/.test(lower)) return { code: 'IRATA-L2', name, also: ['IRATA-L1'] };
    return { code: 'IRATA-L1', name, also: [] };
  }

  if (rawCode && rawCode.trim()) {
    return { code: rawCode.trim().toUpperCase(), name, also: [] };
  }

  return { code: slugCode(name), name, also: [] };
}

type EmployeeParsed = {
  employeeNo: string;
  name: string;
  email: string | null;
  jobTitle: string | null;
  status: InspectorStatus;
  qeApproved: boolean;
  highestQualification: string | null;
  baseLocation: string | null;
  hireDate: Date | null;
  certs: { code: string; name: string; also: string[]; issuer: string | null; issuedOn: Date; expiresOn: Date }[];
};

function parseEmployees(filePath: string): EmployeeParsed[] {
  const rows = parseCsv(readFileSync(filePath, 'utf8'));
  if (rows.length < 2) return [];
  const out: EmployeeParsed[] = [];
  let current: EmployeeParsed | null = null;

  for (const r of rows.slice(1)) {
    const empNo = (r[0] ?? '').trim();
    const certName = (r[11] ?? '').replace(/\s+/g, ' ').trim();
    const certCode = (r[10] ?? '').trim();
    const issuer = (r[12] ?? '').trim() || null;
    const issuedOn = parseFlexibleDate(r[13]) ?? new Date(`${PLACEHOLDER_ISSUED}T12:00:00`);
    const expiresOn = parseFlexibleDate(r[14]) ?? new Date(`${NO_EXPIRY}T12:00:00`);

    if (empNo) {
      const statusRaw = (r[5] ?? 'Active').trim().toLowerCase();
      const status =
        statusRaw === 'inactive'
          ? InspectorStatus.Inactive
          : statusRaw === 'onleave' || statusRaw === 'on leave'
            ? InspectorStatus.OnLeave
            : statusRaw === 'training'
              ? InspectorStatus.Training
              : InspectorStatus.Active;
      current = {
        employeeNo: empNo,
        name: (r[1] ?? '').trim(),
        email: (r[3] ?? '').trim().toLowerCase() || null,
        jobTitle: (r[4] ?? '').trim() || null,
        status,
        qeApproved: /^(yes|y|true|1)$/i.test((r[6] ?? '').trim()),
        highestQualification: (r[7] ?? '').trim() || null,
        baseLocation: (r[8] ?? '').trim() || 'Doha',
        hireDate: parseFlexibleDate(r[9]),
        certs: [],
      };
      out.push(current);
    }

    if (current && certName) {
      const resolved = resolveCertFromName(certName, certCode || undefined);
      current.certs.push({
        ...resolved,
        issuer,
        issuedOn,
        expiresOn,
      });
    }
  }

  return out;
}

type JobTypeRow = {
  deptCode: string;
  code: string;
  name: string;
  description: string | null;
  price: number | null;
  active: boolean;
  requiredCertCode: string;
  requiredCertName: string;
  mandatory: boolean;
};

function parseJobTypes(filePath: string): JobTypeRow[] {
  const rows = parseCsv(readFileSync(filePath, 'utf8'));
  const out: JobTypeRow[] = [];
  for (const r of rows.slice(1)) {
    const deptCode = (r[0] ?? '').trim().toUpperCase();
    const code = (r[1] ?? '').trim();
    if (!deptCode || !code) continue;
    const priceRaw = (r[4] ?? '').trim();
    const price = priceRaw ? Number(priceRaw) : null;
    out.push({
      deptCode,
      code,
      name: (r[2] ?? code).trim(),
      description: (r[3] ?? '').trim() || null,
      price: Number.isFinite(price) ? price : null,
      active: !/^(no|n|false|0)$/i.test((r[5] ?? 'Yes').trim()),
      requiredCertCode: (r[6] ?? '').trim().toUpperCase(),
      requiredCertName: (r[7] ?? '').trim(),
      mandatory: !/^(no|n|false|0)$/i.test((r[8] ?? 'Yes').trim()),
    });
  }
  return out;
}

async function ensureDept(code: string, name: string) {
  let dept =
    (await prisma.department.findFirst({ where: { code } })) ??
    (await prisma.department.findFirst({ where: { name } }));
  if (!dept) {
    dept = await prisma.department.create({
      data: { code, name, managerEmail: 'fahad.mp@applus.com' },
    });
  }
  return dept;
}

async function ensureCert(code: string, name: string, issuer?: string | null) {
  return prisma.certification.upsert({
    where: { code },
    create: { code, name, issuer: issuer ?? null, validityMonths: 60 },
    update: { name, ...(issuer ? { issuer } : {}) },
  });
}

async function main() {
  console.log(`Reading ${EMPLOYEES_CSV}`);
  console.log(`Reading ${JOB_TYPES_CSV}`);

  const employees = parseEmployees(EMPLOYEES_CSV);
  const jobTypeRows = parseJobTypes(JOB_TYPES_CSV);

  const ndt = await ensureDept('NDT', 'NDT Inspection');
  const rigs = await ensureDept('RIGS', 'Rigs');
  const deptByCode = new Map([
    ['NDT', ndt],
    ['RIGS', rigs],
    // Source sheet labels people as TPI — fold into NDT Inspection for this intake
    ['TPI', ndt],
  ]);

  // Catalog from job types first
  for (const jt of jobTypeRows) {
    if (jt.requiredCertCode) {
      await ensureCert(jt.requiredCertCode, jt.requiredCertName || jt.requiredCertCode);
    }
  }

  // Job types (group cert requirements)
  const byKey = new Map<string, JobTypeRow[]>();
  for (const row of jobTypeRows) {
    const key = `${row.deptCode}::${row.code}`;
    const list = byKey.get(key) ?? [];
    list.push(row);
    byKey.set(key, list);
  }

  let jtCreated = 0;
  let jtUpdated = 0;
  for (const [, rows] of byKey) {
    const head = rows[0];
    const dept = deptByCode.get(head.deptCode) ?? (await ensureDept(head.deptCode, head.deptCode));
    const rates = syncJobTypeRates({ dayRateUsd: head.price, defaultHours: 8 });
    const existing = await prisma.jobType.findFirst({
      where: { departmentId: dept.id, code: head.code },
      include: { certRequirements: true },
    });

    let jobTypeId: number;
    if (!existing) {
      const created = await prisma.jobType.create({
        data: {
          departmentId: dept.id,
          code: head.code,
          name: head.name,
          description: head.description,
          active: head.active,
          defaultPriceUsd: rates.defaultPriceUsd,
          dayRateUsd: rates.dayRateUsd,
          hourRateUsd: rates.hourRateUsd,
          defaultHours: rates.defaultHours,
        },
      });
      jobTypeId = created.id;
      jtCreated += 1;
    } else {
      await prisma.jobType.update({
        where: { id: existing.id },
        data: {
          name: head.name,
          description: head.description,
          active: head.active,
          defaultPriceUsd: rates.defaultPriceUsd,
          dayRateUsd: rates.dayRateUsd,
          hourRateUsd: rates.hourRateUsd,
          defaultHours: rates.defaultHours,
        },
      });
      jobTypeId = existing.id;
      jtUpdated += 1;
      await prisma.jobTypeCertRequirement.deleteMany({ where: { jobTypeId } });
    }

    for (const req of rows) {
      if (!req.requiredCertCode) continue;
      const cert = await ensureCert(req.requiredCertCode, req.requiredCertName || req.requiredCertCode);
      await prisma.jobTypeCertRequirement.create({
        data: {
          jobTypeId,
          certificationId: cert.id,
          mandatory: req.mandatory,
        },
      });
    }
  }

  // Employees → NDT
  let created = 0;
  let updated = 0;
  let certLinks = 0;

  for (const emp of employees) {
    const existing =
      (await prisma.inspector.findUnique({ where: { employeeNo: emp.employeeNo } })) ??
      (await prisma.inspector.findFirst({ where: { name: emp.name } }));

    const data = {
      employeeNo: emp.employeeNo,
      name: emp.name,
      email: emp.email,
      departmentId: ndt.id,
      jobTitle: emp.jobTitle,
      status: emp.status,
      qeApproved: emp.qeApproved,
      highestQualification: emp.highestQualification,
      baseLocation: emp.baseLocation,
      hireDate: emp.hireDate,
    };

    let inspectorId: number;
    if (!existing) {
      const row = await prisma.inspector.create({ data });
      inspectorId = row.id;
      created += 1;
    } else {
      if (existing.employeeNo !== emp.employeeNo) {
        const clash = await prisma.inspector.findUnique({ where: { employeeNo: emp.employeeNo } });
        if (clash && clash.id !== existing.id) {
          await prisma.inspector.update({
            where: { id: clash.id },
            data: { employeeNo: `OLD-${clash.id}-${clash.employeeNo}`.slice(0, 40) },
          });
        }
      }
      await prisma.inspector.update({ where: { id: existing.id }, data });
      inspectorId = existing.id;
      updated += 1;
    }

    for (const c of emp.certs) {
      const codes = [c.code, ...c.also];
      for (const code of codes) {
        const cert = await ensureCert(code, code === c.code ? c.name : code, c.issuer);
        const prior = await prisma.inspectorCert.findFirst({
          where: { inspectorId, certificationId: cert.id },
        });
        const status = certStatusFor(c.expiresOn);
        if (prior) {
          await prisma.inspectorCert.update({
            where: { id: prior.id },
            data: { issuedOn: c.issuedOn, expiresOn: c.expiresOn, status },
          });
        } else {
          await prisma.inspectorCert.create({
            data: {
              inspectorId,
              certificationId: cert.id,
              issuedOn: c.issuedOn,
              expiresOn: c.expiresOn,
              status,
            },
          });
          certLinks += 1;
        }
      }
    }
  }

  console.log(`Department: ${ndt.name} (${ndt.code})`);
  console.log(`Employees: created ${created}, updated ${updated}, total ${employees.length}`);
  console.log(`Cert links added: ${certLinks}`);
  console.log(`Job types: created ${jtCreated}, updated ${jtUpdated}, groups ${byKey.size}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
