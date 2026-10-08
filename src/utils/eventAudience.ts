import type { FacultyKey, Society } from '../types/events';

/**
 * Who a society event is for, decided from who the student is — never from a
 * list they keep. `subscribers_only` on `spolky_events` means "for the
 * society's own people": its faculty's students, or the Erasmus students for
 * ESN. reIS is university-wide and cannot be restricted.
 *
 * NOISE CONTROL, NOT ACCESS CONTROL. The fetch is anonymous, so a restricted
 * event still comes down the wire; this decides what a student is SHOWN.
 *
 * Old builds (5.1.1–5.3.0) read the same column through follows, and auto-follow
 * the faculty society and ESN for Erasmus — the same audience, approximately,
 * which is why the column was reused rather than replaced.
 */
export interface Viewer {
  /** null when not known yet (first launch before IS data) — sees public only. */
  facultyKey: FacultyKey | null;
  erasmus: boolean;
}

export type Audience = 'everyone' | 'erasmus' | Exclude<FacultyKey, 'mendelu'>;

export function audienceOf(society: Society | undefined): Audience {
  if (society?.audienceLabel === 'erasmus') return 'erasmus';
  if (society && society.facultyKey !== 'mendelu') return society.facultyKey;
  return 'everyone';
}

/** A student belongs to every audience that fits: an Erasmus student at PEF is both. */
export function canSee(
  event: { societyId: string; subscribersOnly?: boolean },
  societies: Record<string, Society>,
  viewer: Viewer
): boolean {
  if (!event.subscribersOnly) return true;
  const society = societies[event.societyId];
  // Restricted, by a society we cannot name: hide rather than guess an audience.
  if (!society) return false;
  const audience = audienceOf(society);
  if (audience === 'everyone') return true;
  if (audience === 'erasmus') return viewer.erasmus;
  return viewer.facultyKey === audience;
}

export function visibleToStudent<T extends { societyId: string; subscribersOnly?: boolean }>(
  events: T[],
  societies: Record<string, Society>,
  viewer: Viewer
): T[] {
  return events.filter((e) => canSee(e, societies, viewer));
}

/** How the composer names the restricted option; null = this society cannot restrict. */
export function audienceLabelKey(
  society: Society | undefined
): { key: 'admin.audience.faculty' | 'admin.audience.erasmus'; faculty?: string } | null {
  const audience = audienceOf(society);
  if (audience === 'everyone') return null;
  if (audience === 'erasmus') return { key: 'admin.audience.erasmus' };
  return { key: 'admin.audience.faculty', faculty: audience.toUpperCase() };
}
