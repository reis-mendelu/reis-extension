const TIME_ONLY = /^(\d{1,2}):(\d{2})$/;
const DATE_AND_TIME = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/;

/**
 * How far the dev webapp's clock should be moved, in milliseconds, for a
 * `?now=` param — or null when there is none, or it does not parse.
 *
 * An offset rather than a fixed instant: the app's pulse keeps ticking, so a
 * countdown counts down and a lesson really does end while you watch. Seconds
 * come from the real clock for the same reason.
 *
 * `?now=10:30` names a time today; `?now=2026-05-04 08:15` names a moment.
 */
export function resolveDevClockOffset(param: string | null, realNow: Date): number | null {
  if (!param) return null;

  const time = TIME_ONLY.exec(param);
  const full = time ? null : DATE_AND_TIME.exec(param);
  if (!time && !full) return null;

  const hours = Number(time ? time[1] : full![4]);
  const minutes = Number(time ? time[2] : full![5]);
  // setHours does not clamp — "25:99" would roll into the next day, which is
  // not a time anybody typed on purpose.
  if (hours > 23 || minutes > 59) return null;

  const target = new Date(realNow.getTime());
  if (full) target.setFullYear(Number(full[1]), Number(full[2]) - 1, Number(full[3]));
  target.setHours(hours, minutes);

  return target.getTime() - realNow.getTime();
}
