// Deliberately excludes O/0/I/l/1 — these passwords get read aloud and retyped
// by society committees, and an ambiguous glyph turns into a support request.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
const LENGTH = 20;

export function generatePassword(): string {
  const bytes = new Uint32Array(LENGTH);
  crypto.getRandomValues(bytes);
  let out = '';
  for (let i = 0; i < LENGTH; i++) out += ALPHABET[bytes[i] % ALPHABET.length];
  return out;
}

// Mirror of src/services/admin/societyLogin.ts. A Deno Edge Function cannot
// import from src/, so this is a deliberate copy — change both together.
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
