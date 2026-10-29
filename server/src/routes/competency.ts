import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { certStatusFromExpiry } from '../lib/certStatus.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { STAFF_ROLES } from '../services/authz.js';

const router = Router();
router.use(authMiddleware);

function displayStatus(status: string) {
  if (status === 'ExpiringSoon') return 'Expiring Soon';
  if (status === 'Valid') return 'Valid';
  if (status === 'Expired') return 'Expired';
  return status;
}

function daysToExpiry(expiresOn: Date) {
  return Math.round((expiresOn.getTime() - Date.now()) / 86400000);
}

router.get('/', requireRole(...STAFF_ROLES), async (_req, res) => {
  const [certifications, inspectors] = await Promise.all([
    prisma.certification.findMany({ orderBy: { code: 'asc' } }),
    prisma.inspector.findMany({
      where: { status: { not: 'Inactive' } },
      include: {
        department: true,
        inspectorCerts: { include: { certification: true } },
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  const inspectorRows = inspectors.map((ins) => ({
    id: ins.id,
    employeeNo: ins.employeeNo,
    name: ins.name,
    department: ins.department.name,
    certs: ins.inspectorCerts.map((c) => ({
      code: c.certification.code,
      name: c.certification.name,
      status: displayStatus(certStatusFromExpiry(c.expiresOn)),
      expiresOn: c.expiresOn.toISOString().slice(0, 10),
      daysToExpiry: daysToExpiry(c.expiresOn),
    })),
  }));

  const coverage = certifications.map((cert) => {
    const holders = inspectorRows.filter((i) =>
      i.certs.some((c) => c.code === cert.code && c.status !== 'Expired')
    ).length;
    const expiring = inspectorRows.filter((i) =>
      i.certs.some((c) => c.code === cert.code && c.status === 'Expiring Soon')
    ).length;
    return { code: cert.code, name: cert.name, holders, expiring };
  });

  const expiringList = inspectorRows
    .flatMap((i) =>
      i.certs
        .filter((c) => c.status === 'Expiring Soon' || c.status === 'Expired')
        .map((c) => ({
          inspector: i.name,
          employeeNo: i.employeeNo,
          department: i.department,
          code: c.code,
          expires: c.expiresOn,
          status: c.status,
          days: c.daysToExpiry,
        }))
    )
    .sort((a, b) => a.days - b.days);

  const gaps = coverage
    .filter((c) => c.holders < 2)
    .map((c) => ({ code: c.code, name: c.name, holders: c.holders }));

  const totalCells = inspectorRows.length * certifications.length;
  const heldCells = inspectorRows.reduce(
    (sum, i) => sum + i.certs.filter((c) => c.status !== 'Expired').length,
    0
  );

  res.json({
    certifications,
    inspectors: inspectorRows,
    coverage,
    expiringList,
    gaps,
    stats: {
      coveragePct: totalCells ? Math.round((heldCells / totalCells) * 100) : 0,
      certCount: certifications.length,
      inspectorCount: inspectorRows.length,
      expiringSoon: expiringList.filter((e) => e.status === 'Expiring Soon').length,
      expired: expiringList.filter((e) => e.status === 'Expired').length,
    },
  });
});

export default router;
