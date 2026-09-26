import type { MapEvent, Society } from '../types/events';

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
 * An empty ARRAY is the opposite: a real answer, meaning the student follows
 * nothing. The caller says which it has; this never guesses.
 *
 * Both hide the restricted events, and only the reason differs. Unknown resolves
 * the same way as "follows nothing" because of which direction the flicker runs:
 * showing everything and then taking events away makes pins and rows vanish from
 * under a thumb already moving towards one, while hiding and then adding is the
 * ordinary shape of a screen finishing its load. In practice neither is visible —
 * the events arrive over the network and the subscriptions come off the disk, so
 * the answer is nearly always known before there is anything to filter.
 */
export function visibleToStudent(
  events: MapEvent[],
  subscribed: readonly string[] | null
): MapEvent[] {
  const follows = subscribed ?? [];
  return events.filter((event) => !event.subscribersOnly || follows.includes(event.societyId));
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
 * button says that instead.
 *
 * "Students of X" only for the society X's students follow BY DEFAULT
 * (`autoFollowFaculty`): the filter runs on subscriptions, and a faculty only
 * seeds the default. EY is filed under PEF, but PEF students are not
 * auto-subscribed to it, so it gets the generic wording.
 *
 * Still approximate, deliberately: a PEF student who unsubscribed from SUPEF
 * will not see "Jen studenti PEF", and an AF student who subscribed will. The
 * form carries a line under the control saying so, which is where the exactness
 * belongs — the button is for recognising the audience, not defining it.
 */
export function audienceLabelKey(society: Society | undefined): AudienceLabel {
  if (society?.audienceLabel === 'erasmus') return { key: 'admin.audience.erasmus' };
  if (society?.autoFollowFaculty && society.facultyKey !== 'mendelu') {
    return { key: 'admin.audience.faculty', faculty: society.facultyKey.toUpperCase() };
  }
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
 * Named when we know the name. A session whose society is not in the catalog
 * has no name to print, and the first version of this interpolated the empty
 * string into the sentence and rendered "Uvidí studenti, kteří odebírají ." So
 * the nameless case gets its own sentence rather than a hole in this one.
 */
export function audienceHint(society: Society | undefined): AudienceHint {
  return society
    ? { key: 'map.audienceHint', society: society.name }
    : { key: 'map.audienceHintGeneric' };
}
