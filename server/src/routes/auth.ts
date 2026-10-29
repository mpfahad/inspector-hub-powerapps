import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { sessionCookieClearOptions, sessionCookieOptions } from '../config/security.js';
import { authMiddleware, signToken } from '../middleware/auth.js';
import { authenticateLocal } from '../services/identity.js';
import { loginSchema } from '../lib/schemas.js';
import { validateBody } from '../lib/validate.js';

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please try again later.' },
});

router.post('/login', loginLimiter, validateBody(loginSchema), async (req, res) => {
  const { email, password } = req.body as { email: string; password: string };
  const identity = await authenticateLocal(email, password);
  if (!identity) {
    res.status(401).json({ error: 'Invalid credentials' });
    return;
  }
  const token = signToken(identity);
  res.cookie('irppms_token', token, sessionCookieOptions());
  res.json({ user: identity });
});

router.post('/logout', (_req, res) => {
  res.clearCookie('irppms_token', sessionCookieClearOptions());
  res.json({ ok: true });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({ user: req.user });
});

export default router;
