/**
 * The two pieces the calendar's anchored popovers share: where the box goes
 * next to the clicked block, and how its date reads. Shared by
 * `CustomEventModal` and `RsvpBlockPopover`, so a block the student made and a
 * block an RSVP made open in the same place.
 */

/** Beside the click, flipped left near the right edge, clamped into the viewport. */
export function popoverPosition(
  anchor: { x: number; y: number },
  width: number,
  height: number
): { left: number; top: number } {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  let x = anchor.x + 14;
  let y = anchor.y - 24;
  if (x + width > vw - 8) x = anchor.x - width - 14;
  if (y + height > vh - 8) y = vh - height - 8;
  if (y < 8) y = 8;
  return { left: Math.max(8, x), top: y };
}

/** "so 21. listopadu" from a calendar block's YYYYMMDD. */
export function formatDateLabel(yyyymmdd: string, language: string): string {
  if (!yyyymmdd || yyyymmdd.length !== 8) return '';
  const y = parseInt(yyyymmdd.slice(0, 4));
  const m = parseInt(yyyymmdd.slice(4, 6)) - 1;
  const d = parseInt(yyyymmdd.slice(6, 8));
  const locale = language === 'en' ? 'en-GB' : 'cs-CZ';
  return new Date(y, m, d).toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
  });
}
