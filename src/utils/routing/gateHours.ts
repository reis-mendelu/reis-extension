/**
 * When the gated stretches of the walking network are actually walkable.
 *
 * There is exactly one gate today. The mechanism is general because the cost of
 * making it general was one string.
 */

/**
 * The botanical garden, as a MENDELU student experiences it: ISIC on the reader
 * at the gate, weekdays 06:00–20:00, free.
 *
 * These are NOT the hours published on arboretum.mendelu.cz. That page says
 * Mon–Fri 07:00–15:00, closed weekends, 150 Kč / 70 Kč, and describes the
 * PAYING PUBLIC entering through the main building — it also mentions ringing a
 * bell at the Gen. Píky gate, which is the visitor procedure, not the card one.
 * Routing by the published hours would shut the shortcut five hours early, over
 * most of the afternoon teaching block, for students who can in fact walk
 * through.
 *
 * So: if someone "corrects" these numbers against the website, they have read
 * the wrong regime. The website is right about the public and silent about the
 * card reader.
 *
 * Czech public holidays are not modelled. The failure is a student walking to a
 * gate that does not open, a handful of days a year; adding a date list later
 * is cheap if it turns out to matter.
 */
export const GARDEN_HOURS = { fromHour: 6, toHour: 20, weekdaysOnly: true } as const;

export function isGateOpen(gateId: string, now: Date): boolean {
  // A gate nobody has modelled is not a locked gate — it is a path. Defaulting
  // to shut would silently delete stretches of the network on a typo, and a
  // missing route is the one failure mode here that says nothing about itself.
  if (gateId !== 'garden') return true;
  const day = now.getDay(); // 0 Sunday … 6 Saturday
  if (day === 0 || day === 6) return false;
  const hour = now.getHours();
  return hour >= GARDEN_HOURS.fromHour && hour < GARDEN_HOURS.toHour;
}
