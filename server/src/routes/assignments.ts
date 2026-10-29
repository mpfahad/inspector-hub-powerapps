import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authMiddleware, requireRole } from '../middleware/auth.js';
import { acceptAssignment, rejectAssignment } from '../services/jobWorkflow.js';
import { recordAudit } from '../services/audit.js';
import { getAssignmentForUser, getInspectorForUser } from '../services/authz.js';
import { sendRouteError } from '../lib/httpErrors.js';
import { validateBody } from '../lib/validate.js';
import { rejectAssignmentSchema } from '../lib/schemas.js';

const router = Router();
router.use(authMiddleware);

const assignmentInclude = {
  job: { include: { client: true, department: true, jobType: true } },
  inspector: true,
};

const completedWhere = (inspectorId: number) => ({
  inspectorId,
  status: { in: ['Complete', 'Accepted', 'Active'] as ('Complete' | 'Accepted' | 'Active')[] },
  job: { status: { in: ['Completed', 'Closed'] as ('Completed' | 'Closed')[] } },
});

router.get('/mine', requireRole('Inspector'), async (req, res) => {
  const inspector = await getInspectorForUser(req.user!);
  if (!inspector) {
    res.json({ pending: [], pendingQe: [], active: [], completed: [] });
    return;
  }

  const [active, completed] = await Promise.all([
    prisma.assignment.findMany({
      where: {
        inspectorId: inspector.id,
        status: { in: ['Accepted', 'Active', 'PendingAcceptance'] },
        job: { status: { in: ['Active', 'PendingAcceptance'] } },
      },
      include: assignmentInclude,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.assignment.findMany({
      where: completedWhere(inspector.id),
      include: assignmentInclude,
      orderBy: { job: { completedAt: 'desc' } },
    }),
  ]);

  res.json({ pending: [], pendingQe: [], active, completed });
});

router.post('/:id/accept', requireRole('Inspector', 'Coordinator', 'Manager', 'Admin'), async (req, res) => {
  try {
    const assignmentId = Number(req.params.id);
    const existing = await getAssignmentForUser(assignmentId, req.user!);
    if (existing.status !== 'PendingAcceptance') {
      res.status(400).json({ error: 'Assignment is not awaiting acceptance' });
      return;
    }
    const assignment = await acceptAssignment(assignmentId, req.user?.email);
    await recordAudit({
      userId: req.user?.id,
      action: 'assignment.accepted',
      entityType: 'Assignment',
      entityId: assignment.id,
      payload: { jobId: assignment.jobId, inspectorId: assignment.inspectorId },
    });
    res.json(assignment);
  } catch (err) {
    sendRouteError(res, err, 'Accept failed');
  }
});

router.post(
  '/:id/reject',
  requireRole('Inspector', 'Coordinator', 'Manager', 'Admin'),
  validateBody(rejectAssignmentSchema),
  async (req, res) => {
  const { reason } = req.body as { reason: string };
  try {
    const assignmentId = Number(req.params.id);
    const existing = await getAssignmentForUser(assignmentId, req.user!);
    if (existing.status !== 'PendingAcceptance') {
      res.status(400).json({ error: 'Assignment is not awaiting acceptance' });
      return;
    }
    const assignment = await rejectAssignment(assignmentId, reason, req.user?.email);
    await recordAudit({
      userId: req.user?.id,
      action: 'assignment.rejected',
      entityType: 'Assignment',
      entityId: assignment.id,
      payload: { jobId: assignment.jobId, inspectorId: assignment.inspectorId, reason },
    });
    res.json(assignment);
  } catch (err) {
    sendRouteError(res, err, 'Reject failed');
  }
});

export default router;
