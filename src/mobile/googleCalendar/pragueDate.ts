const PRAGUE_DAY = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Prague',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const PRAGUE_OFFSET = new Intl.DateTimeFormat('en-US', {
  timeZone: 'Europe/Prague',
  timeZoneName: 'longOffset',
});

/**
 * Today's date in Prague as YYYY-MM-DD. The past/future line of the sync.
 * Built from parts: format() is locale text, and this is compared with ISO
 * dates and sent to Google.
 */
export function pragueToday(now: Date = new Date()): string {
  const p = Object.fromEntries(PRAGUE_DAY.formatToParts(now).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function offsetAt(at: Date): string {
  const name = PRAGUE_OFFSET.formatToParts(at).find((p) => p.type === 'timeZoneName')?.value;
  return name?.replace('GMT', '') || '+01:00';
}

/**
 * Today's 00:00 in Prague as RFC 3339. The offset is the one in force at
 * midnight: on a DST change day it differs from the one now.
 */
export function pragueMidnight(now: Date = new Date()): string {
  const today = pragueToday(now);
  const guess = `${today}T00:00:00${offsetAt(now)}`;
  return `${today}T00:00:00${offsetAt(new Date(guess))}`;
}
