import { prisma } from '../lib/prisma.js';

type AuditInput = {
  userId?: number;
  action: string;
  entityType: string;
  entityId?: number;
  payload?: Record<string, unknown>;
};

export async function recordAudit({ userId, action, entityType, entityId, payload }: AuditInput) {
  await prisma.auditEvent.create({
    data: {
      userId: userId ?? null,
      action,
      entityType,
      entityId: entityId ?? null,
      payload: payload ? JSON.stringify(payload) : null,
    },
  });
}
