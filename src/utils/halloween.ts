/**
 * The Halloween week: pumpkins, bats and orange instead of green, from Friday
 * 30 October to the end of Friday 6 November 2026. A day before Halloween on
 * purpose (Dominik, 2026-10-30): the Friday is the last teaching day before
 * the weekend, when students are in the app.
 *
 * Dates in the code, not a switch in Supabase: nothing has to be fetched, the
 * look cannot be left on by mistake, and a build that reaches a store late
 * still shows it for the days that are left. Local time, so it turns on at the
 * student's own midnight.
 *
 * Pinned to 2026 on purpose: it does not come back on its own next year. Move
 * both dates to bring it back.
 */
const START = new Date(2026, 9, 30); // 30 Oct, 00:00
const END = new Date(2026, 10, 7); // 7 Nov, 00:00 — the first moment it is over

export function isHalloween(now: Date): boolean {
  return now >= START && now < END;
}
