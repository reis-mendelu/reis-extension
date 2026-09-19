/**
 * How long a campus walk takes, in whole minutes.
 *
 * The map used to label a route "436 m", which is a measurement rather than an
 * answer — nobody plans their morning in metres. Campus wayfinding signage and
 * the "ten-minute campus" that universities design to both work in walking
 * time, and so does every student deciding whether they can make it between
 * lessons.
 */

/** 4.8 km/h: someone with a bag crossing a courtyard, not a race walker. */
export const WALK_M_PER_MIN = 80;

export function walkMinutes(lengthM: number): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return 1;
  // Never zero. The shortest route on campus is 25 m, and "0 min" answers
  // nothing — a minute is the floor of what a walk can usefully be called.
  return Math.max(1, Math.round(lengthM / WALK_M_PER_MIN));
}
