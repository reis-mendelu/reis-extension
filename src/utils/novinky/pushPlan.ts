/**
 * Which Novinky rows become a system notification now. Pure: the phone's
 * src/mobile/novinkyNotifications feeds it the rows Novinky shows (the same
 * builders) and the ids it notified before.
 *
 * Every row is notified once (the 1:1 model agreed 2026-11-17). Rows the
 * student has already seen in Novinky are recorded and not posted. The first
 * run has no record: everything on screen then is recorded silently, or the
 * update that brings this would post a backlog.
 */

/** One notification per kind per run: Android gives each its own channel. */
export type PushKind = 'terms' | 'points' | 'boxes' | 'societies';

export interface PushRow {
  id: string;
  kind: PushKind;
  title: string;
  body: string;
  /** The subject a tap opens, when the row is about one. */
  courseCode?: string;
}

export interface PushGroup {
  kind: PushKind;
  rows: PushRow[];
}

const KIND_ORDER: PushKind[] = ['terms', 'points', 'boxes', 'societies'];

/** Ids old enough to have left Novinky are no use; the newest are kept. */
export const NOTIFIED_CAP = 500;

export function planPushes(
  rows: readonly PushRow[],
  notifiedBefore: readonly string[] | undefined,
  seenInApp: ReadonlySet<string>
): { post: PushGroup[]; notified: string[] } {
  const known = new Set(notifiedBefore ?? []);
  const fresh = rows.filter((r) => !known.has(r.id));
  const notified = [...known, ...fresh.map((r) => r.id)].slice(-NOTIFIED_CAP);
  if (!notifiedBefore) return { post: [], notified };
  const toPost = fresh.filter((r) => !seenInApp.has(r.id));
  const post = KIND_ORDER.map((kind) => ({
    kind,
    rows: toPost.filter((r) => r.kind === kind),
  })).filter((g) => g.rows.length > 0);
  return { post, notified };
}
