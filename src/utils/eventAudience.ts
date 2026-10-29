import type { FacultyKey, Society } from '../types/events';
import { isPartner, matchesAudience } from './partnerAudience';

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
  /** May see ESN's Erasmus-only events. Broad: also set by a text test on IS. */
  erasmus: boolean;
  /**
   * On IS's exchange programme (Z-EXC): sees ESN's events and nobody else's
   * (decision 2026-10-29). Narrow on purpose, because this one HIDES: the
   * Erasmus text test can match a Czech student's own trip abroad, and that
   * student would lose their faculty's events.
   */
  exchange: boolean;
  /** Base study-programme code ('B-OI'), null when IS did not say. Partners only. */
  programme?: string | null;
}

/**
 * IS's exchange programme. The `isErasmus` text test reads studium.pl in the
 * session's language, and the Czech name of this programme ("Zahraniční
 * studenti - krátkodobé studijní pobyty") matches none of its words, so a
 * student with IS in Czech was never shown ESN's Erasmus-only events. The code
 * is the same in both languages. It is also the one signal trusted to HIDE
 * events (`exchange`), which the text test is not.
 */
export const EXCHANGE_PROGRAMME = 'Z-EXC';

/** ESN MENDELU, by id: an edited label must not change who exchange students see. */
const ESN = 'esn';
/**
 * reIS's own rows: no society, the console's `admin`, academic deadlines, and
 * `reis`, which is university-wide whatever the row says (as in spolkyService).
 * reIS is the app, not a society, so even an exchange student sees these.
 */
export function isReisOwn(societyId: string | null | undefined): boolean {
  return (
    !societyId || societyId === 'admin' || societyId === 'reis' || societyId.startsWith('academic_')
  );
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
  const society = societies[event.societyId];
  // Every other society writes in Czech for Czech students, so for an exchange
  // student even its events "for everyone" are noise. reIS is the app, not a
  // society. Checked before partners: a partner's faculty-wide audience would
  // otherwise match them too.
  if (viewer.exchange) return event.societyId === ESN || isReisOwn(event.societyId);
  // Partners reach their audience and nobody else, whatever the event's own
  // flag (spec 2026-10-09). Noise control, like the rest of this file.
  if (society && isPartner(society)) return matchesAudience(society.audience, viewer);
  if (!event.subscribersOnly) return true;
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
