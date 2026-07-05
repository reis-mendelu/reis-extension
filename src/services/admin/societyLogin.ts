/**
 * Society accounts log in with the real email on their Supabase Auth account
 * (e.g. "admin@supef.cz") — the same credentials they use for the ops dashboard.
 * We only normalize casing/whitespace before sign-in: Supabase treats emails
 * case-insensitively, but copy-paste can introduce stray spaces or capitals.
 */
export function normalizeEmail(input: string): string {
  return input.trim().toLowerCase();
}
