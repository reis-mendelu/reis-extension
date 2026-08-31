/**
 * Societies sign in with a plain name ("supef"), not an address. Supabase Auth
 * has no username credential — email, phone, OAuth, SSO, anonymous and Web3 are
 * the only ones — so a username is mapped to a synthetic address here, and ONLY
 * here. Nothing else in the codebase may construct a login address.
 *
 * `.invalid` is reserved by RFC 2606 and can never route mail. That is the
 * point: these accounts are recovered by a reIS admin, not by email, and an
 * unroutable domain says so honestly instead of impersonating a real one the way
 * the old `admin@esn.cz` addresses did.
 *
 * Break-glass exception: an input that already contains "@" passes through. The
 * reis_admin account keeps a real mailbox, because it is the only role allowed
 * to reset anyone — if it locks itself out, nothing in this feature can recover
 * it.
 */
export const SOCIETY_EMAIL_DOMAIN = 'societies.invalid';

const USERNAME_RE = /^[a-z0-9][a-z0-9_-]*$/;

export function toAuthEmail(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed;
  if (!USERNAME_RE.test(trimmed)) {
    throw new Error(`invalid username: ${JSON.stringify(input)}`);
  }
  return `${trimmed}@${SOCIETY_EMAIL_DOMAIN}`;
}

/** @deprecated Removed in Task 2 once createAdminSlice stops importing it. */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
