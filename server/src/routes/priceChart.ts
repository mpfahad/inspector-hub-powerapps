import { Router } from 'express';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { assertCanAccessDepartment, STAFF_ROLES } from '../services/authz.js';
import { getPriceChart } from '../services/pricing.js';
import { sendRouteError } from '../lib/httpErrors.js';

const router = Router();
router.use(authMiddleware);
router.use(requireRole(...STAFF_ROLES));

/** Read-only mirror of job-type default prices (UI edits prices on the job type). */
router.get('/', async (req, res) => {
  const departmentId = req.query.departmentId ? Number(req.query.departmentId) : undefined;
  if (Number.isFinite(departmentId)) {
    try {
      assertCanAccessDepartment(req.user!, departmentId as number);
    } catch (err) {
      sendRouteError(res, err, 'Forbidden');
      return;
    }
  }
  res.json(await getPriceChart(Number.isFinite(departmentId) ? departmentId : undefined));
});

router.put('/', (_req, res) => {
  res.status(410).json({
    error: 'Price chart removed — set Default price on each job type instead',
  });
});

export default router;
