import type { CertStatus } from '@prisma/client';

/** Days remaining until ExpiringSoon (matches assignment engine). */
export const CERT_EXPIRING_SOON_DAYS = 90;

export function certStatusFromExpiry(expiresOn: Date, asOf = new Date()): CertStatus {
  const days = Math.round((expiresOn.getTime() - asOf.getTime()) / 86400000);
  if (days < 0) return 'Expired';
  if (days <= CERT_EXPIRING_SOON_DAYS) return 'ExpiringSoon';
  return 'Valid';
}

export function expiresOnCutoffForExpiring(asOf = new Date()) {
  const cutoff = new Date(asOf);
  cutoff.setHours(23, 59, 59, 999);
  cutoff.setDate(cutoff.getDate() + CERT_EXPIRING_SOON_DAYS);
  return cutoff;
}
