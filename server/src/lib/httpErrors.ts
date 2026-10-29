import type { Response } from 'express';
import { AuthzError } from '../services/authz.js';

export function sendRouteError(res: Response, err: unknown, fallback: string) {
  if (err instanceof AuthzError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  res.status(400).json({ error: err instanceof Error ? err.message : fallback });
}
