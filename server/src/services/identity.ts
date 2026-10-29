import bcrypt from 'bcryptjs';
import type { User, UserRole } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * Identity providers that can issue the same IRPPMS session (cookie JWT `irppms_token`).
 *
 * Local: email + passwordHash (UAT / until Entra is connected).
 * Entra: future OIDC module validates the Microsoft ID token, then calls
 * `loadOrLinkEntraUser` and `issueSession` — it must NOT invent a parallel cookie.
 *
 * Role mapping when Entra is wired (app roles or groups → UserRole):
 *   IRPPMS.Admin        → Admin
 *   IRPPMS.Manager      → Manager
 *   IRPPMS.Coordinator  → Coordinator
 *   IRPPMS.Inspector    → Inspector
 * See docs/AUTH.md. Do not add a "Login with Microsoft" button until that OIDC
 * flow is registered and testable.
 */
export type IdentityProviderName = 'local' | 'entra';

export type AppIdentity = {
  id: number;
  email: string;
  role: UserRole;
  fullName: string;
  inspectorId: number | null;
};

export async function resolveInspectorIdForUser(user: { id: number; email: string }): Promise<number | null> {
  const linked = await prisma.inspector.findUnique({ where: { userId: user.id } });
  if (linked) return linked.id;
  const byEmail = await prisma.inspector.findFirst({ where: { email: user.email } });
  return byEmail?.id ?? null;
}

export function toAppIdentity(user: User, inspectorId: number | null): AppIdentity {
  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    inspectorId,
  };
}

export async function loadSessionUser(userId: number): Promise<AppIdentity | null> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return null;
  const inspectorId = await resolveInspectorIdForUser(user);
  return toAppIdentity(user, inspectorId);
}

/** Local email+password. Entra users (no passwordHash / identityProvider=entra) cannot use this path. */
export async function authenticateLocal(email: string, password: string): Promise<AppIdentity | null> {
  const normalized = email.trim().toLowerCase();
  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return null;
  if (user.identityProvider !== 'local' || !user.passwordHash) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const inspectorId = await resolveInspectorIdForUser(user);
  return toAppIdentity(user, inspectorId);
}

/**
 * Future Entra hook: look up by oid (`externalSubject`), else match email and
 * stamp oid + identityProvider=entra. Then return the same AppIdentity shape
 * used by local login so `signToken` / session cookie stay unchanged.
 *
 * Not implemented here — requires a real Entra app registration and ID token.
 */
export async function loadOrLinkEntraUser(_claims: {
  oid: string;
  email: string;
  displayName?: string;
  appRoles?: string[];
}): Promise<AppIdentity | null> {
  return null;
}
