/**
 * Which admin session the suggestions toast has already spoken to, kept at
 * module level: the toast is mounted in the admin console AND the student app,
 * one at a time, and a remount between them must not announce again
 * (SuggestionsToast).
 */
let announcedFor: string | null = null;

export function wasAnnounced(email: string): boolean {
  return announcedFor === email;
}

export function markAnnounced(email: string | null): void {
  announcedFor = email;
}

/** Test-only: forget which session was announced. */
export function __resetSuggestionsToastForTests(): void {
  announcedFor = null;
}
