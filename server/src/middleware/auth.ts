import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { getJwtSecret } from '../config/security.js';
import { loadSessionUser, type AppIdentity } from '../services/identity.js';

const JWT_SECRET = getJwtSecret();

export type AuthUser = AppIdentity;

/** Session JWT. Payload is `{ id }` — role is loaded from DB on each request. */
export function signToken(user: AuthUser) {
  return jwt.sign({ id: user.id }, JWT_SECRET, { expiresIn: '8h' });
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.irppms_token ?? req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { id?: number };
    if (!decoded?.id) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    const user = await loadSessionUser(decoded.id);
    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Forbidden' });
      return;
    }
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
