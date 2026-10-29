/** Display currency for IRPPMS (amounts stored in *Usd schema fields). */
export const CURRENCY_CODE = 'QAR';

/** Format a money amount for UI, e.g. `QAR 150`. */
export function formatMoney(amount: number | null | undefined): string {
  if (amount == null || !Number.isFinite(amount)) return '—';
  return `${CURRENCY_CODE} ${amount}`;
}
