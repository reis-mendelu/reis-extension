/**
 * How long a campus walk takes, in whole minutes.
 *
 * The map used to label a route "436 m", which is a measurement rather than an
 * answer — nobody plans their morning in metres. Campus wayfinding signage and
 * the "ten-minute campus" that universities design to both work in walking
 * time, and so does every student deciding whether they can make it between
 * lessons.
 */

/**
 * 6 km/h. Measured rather than assumed.
 *
 * This was 80 m/min — 4.8 km/h, chosen as "someone with a bag crossing a
 * courtyard." On the 200–400 m hops the map drew at the time, being a minute
 * out cost nothing, so nobody checked it.
 *
 * It does not survive a long walk. FRRMS to building Q, through the botanical
 * garden, is 1326 m (402 m to the Gen. Píky gate, 596 m through the garden,
 * 328 m from the arboretum gate to Q). 80 m/min prints 17 minutes for that; it
 * is walked in about 12, which is 110 m/min. Five minutes out, on the way to a
 * lecture, is the entire question the number exists to answer.
 *
 * 100 rather than the measured 110: the 110 came from someone who walks this
 * route daily and knows every turn, and the estimate should not assume that of
 * a first-year. The cost is borne where it is cheap — the shortest campus hops
 * now round down a minute (123 m prints "1 min" instead of "2") — and the gain
 * is where it matters, on the walks long enough to make somebody late.
 */
export const WALK_M_PER_MIN = 100;

export function walkMinutes(lengthM: number): number {
  if (!Number.isFinite(lengthM) || lengthM <= 0) return 1;
  // Never zero. The shortest route on campus is 25 m, and "0 min" answers
  // nothing — a minute is the floor of what a walk can usefully be called.
  return Math.max(1, Math.round(lengthM / WALK_M_PER_MIN));
}
