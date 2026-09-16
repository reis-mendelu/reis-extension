import { ASSOCIATION_PROFILES } from '../services/spolky/config';
import type { MapEvent } from '../types/events';

/**
 * Who a society event is for.
 *
 * A society picks, per event, between everyone's map and the maps of the
 * students who follow it (`subscribers_only` on `spolky_events`).
 *
 * NOISE CONTROL, NOT ACCESS CONTROL. The map's fetch is anonymous and
 * subscriptions live in the student's own IndexedDB, never on the server, so a
 * restricted event still comes down the wire and anyone reading the API sees
 * it. This decides what a student is SHOWN, never what they could obtain.
 */

/**
 * The events a student should see, given the societies they follow.
 *
 * `subscribed` is `null` while the answer is not known yet — `useSpolkySettings`
 * reads IndexedDB, so on a cold open there are a couple of ticks where the list
 * is empty because nothing has loaded, not because the student follows nothing.
 * Hiding then would blink every restricted event off the map and back, and an
 * empty ARRAY is a real answer that must be honoured. So the caller says which
 * it has; this never guesses.
 */
export function visibleToStudent(
  events: MapEvent[],
  subscribed: readonly string[] | null
): MapEvent[] {
  if (subscribed === null) return events;
  return events.filter((event) => !event.subscribersOnly || subscribed.includes(event.societyId));
}

/** What to call a society's own audience, as an i18n key plus its one variable. */
export interface AudienceLabel {
  key: 'admin.audience.faculty' | 'admin.audience.erasmus' | 'admin.audience.followers';
  faculty?: string;
}

/**
 * How the restricted option is labelled for THIS society.
 *
 * "Jen odběratelé" is the mechanism talking. A society thinks in terms of who
 * the event is for — its faculty's students, or the Erasmus crowd — so the
 * button says that instead, from `facultyIds`.
 *
 * It is approximate, deliberately: the filter runs on subscriptions, and a
 * faculty only seeds the default. A PEF student who unsubscribed from SUPEF
 * will not see "Jen studenti PEF", and an AF student who subscribed will. The
 * form carries a line under the control saying so, which is where the exactness
 * belongs — the button is for recognising the audience, not defining it.
 */
export function audienceLabelKey(societyId: string): AudienceLabel {
  const profile = ASSOCIATION_PROFILES[societyId];
  if (profile?.audienceLabelKey === 'erasmus') return { key: 'admin.audience.erasmus' };
  const faculties = profile?.facultyIds ?? [];
  // Exactly one: "students of X" is only true when there is a single X. A
  // society spanning two faculties gets the generic wording rather than a list
  // that would not fit the button anyway.
  if (faculties.length === 1) return { key: 'admin.audience.faculty', faculty: faculties[0] };
  return { key: 'admin.audience.followers' };
}

/** The hint under the control, as an i18n key plus its one variable. */
export interface AudienceHint {
  key: 'map.audienceHint' | 'map.audienceHintGeneric';
  society?: string;
}

/**
 * The line that keeps the button's promise honest.
 *
 * Named when we know the name. A session whose society is not in
 * `ASSOCIATION_PROFILES` — the reis_admin super-admin, and the dev session,
 * which both carry ids that are not associations — has no name to print, and
 * the first version of this interpolated the empty string into the sentence
 * and rendered "Uvidí studenti, kteří odebírají ." So the nameless case gets
 * its own sentence rather than a hole in this one.
 */
export function audienceHint(societyId: string): AudienceHint {
  const name = ASSOCIATION_PROFILES[societyId]?.name;
  return name ? { key: 'map.audienceHint', society: name } : { key: 'map.audienceHintGeneric' };
}
