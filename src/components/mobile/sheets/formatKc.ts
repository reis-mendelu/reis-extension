/**
 * In the APP's language — WebISKAM's own text follows the phone's instead.
 * `whole`: no ",00" on a whole amount (a claim reads "5 370 Kč").
 */
export function formatKc(amount: number, language: string, opts?: { whole?: boolean }): string {
  const whole = opts?.whole && Number.isInteger(amount);
  return new Intl.NumberFormat(language === 'cz' ? 'cs-CZ' : 'en-GB', {
    style: 'currency',
    currency: 'CZK',
    ...(whole ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {}),
  }).format(amount);
}
