const DEV_JWT_FALLBACK = 'dev-secret-change-in-production';

export const isProduction = process.env.NODE_ENV === 'production';

/** Validates JWT secret at startup — required in production (Azure AD–ready session signing). */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();

  if (isProduction) {
    if (!secret || secret.length < 32) {
      throw new Error(
        'JWT_SECRET must be set to a cryptographically strong value (32+ characters) in production.'
      );
    }
    if (secret === DEV_JWT_FALLBACK) {
      throw new Error('JWT_SECRET cannot use the development default in production.');
    }
    return secret;
  }

  if (!secret) {
    console.warn('[security] JWT_SECRET not set — using development fallback only.');
    return DEV_JWT_FALLBACK;
  }

  if (secret.length < 32) {
    console.warn('[security] JWT_SECRET is shorter than 32 characters.');
  }

  return secret;
}

export function sessionCookieOptions() {
  const secure = process.env.COOKIE_SECURE === 'true' || isProduction;
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    maxAge: 8 * 3600000,
    path: '/',
  };
}

/** Same flags as the session cookie (minus maxAge) so logout actually clears `irppms_token`. */
export function sessionCookieClearOptions() {
  const { httpOnly, sameSite, secure, path } = sessionCookieOptions();
  return { httpOnly, sameSite, secure, path };
}
