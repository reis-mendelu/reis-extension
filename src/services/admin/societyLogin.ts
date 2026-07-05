/**
 * Society accounts log in by handle (== association_id, e.g. "supef"). Supabase
 * Auth keys on email, so we map the handle to a fixed synthetic address that
 * never receives mail (RFC 2606 `.invalid`). The society never sees this string.
 */
export const SOCIETY_EMAIL_DOMAIN = 'societies.reis.invalid';

export function handleToEmail(handle: string): string {
  return `${handle.trim().toLowerCase()}@${SOCIETY_EMAIL_DOMAIN}`;
}
