// Pure helpers for ComposerTimeField — the type-or-pick time combobox.
// Kept out of the component so the masking/validation/filtering logic is unit
// tested and the component stays small. Times are "HH:MM" 24h strings.

// The clickable list is quarter-hour steps only — society events start on tidy
// times, and 96 rows already covers the day. Free typing still allows any
// minute (e.g. 19:35), so precision isn't lost, it's just off the fast path.
export const TIME_STEP_MIN = 15;

export const TIME_OPTIONS: string[] = Array.from({ length: (24 * 60) / TIME_STEP_MIN }, (_, i) => {
  const mins = i * TIME_STEP_MIN;
  const h = String(Math.floor(mins / 60)).padStart(2, '0');
  const m = String(mins % 60).padStart(2, '0');
  return `${h}:${m}`;
});

// The list opens scrolled here when there's no value yet — early evening is
// where society life happens, so the common picks are one glance away instead
// of a scroll down from midnight.
export const EVENING_ANCHOR = '17:00';

// Turn raw keystrokes into a live "HH:MM" display. Digits only; the colon is
// inserted automatically. A leading digit that can't begin a valid 2-digit hour
// (>2) is read as a single-digit hour, so "9" becomes "09" and "930" → "09:30"
// without forcing the user to type the leading zero. Hours clamp to 23, minutes
// to 59, so the field can never show an impossible time.
export function maskTimeInput(raw: string): string {
  let d = raw.replace(/\D/g, '').slice(0, 4);
  if (d === '') return '';
  if (Number(d[0]) > 2) d = ('0' + d).slice(0, 4);
  if (d.length <= 2) {
    if (d.length === 2 && Number(d) > 23) return '23';
    return d;
  }
  let hh = d.slice(0, 2);
  if (Number(hh) > 23) hh = '23';
  let mm = d.slice(2);
  if (mm.length === 2 && Number(mm) > 59) mm = '59';
  return `${hh}:${mm}`;
}

// A complete, committable time: zero-padded 24h HH:MM. Partial masks ("19",
// "19:3") and impossible times are rejected so onChange only ever fires a value
// the rest of the composer can trust.
export function isCompleteTime(s: string): boolean {
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

// Filter the quarter-hour list by what's been typed, matching on digits so the
// colon is irrelevant. A lone "9" also matches the zero-padded "09:*" block,
// mirroring maskTimeInput's single-digit-hour rule.
export function filterTimeOptions(text: string): string[] {
  const q = text.replace(/\D/g, '');
  if (q === '') return TIME_OPTIONS;
  const prefixes = [q];
  if (q.length === 1 && Number(q) > 2) prefixes.push('0' + q);
  return TIME_OPTIONS.filter((o) => {
    const digits = o.replace(':', '');
    return prefixes.some((p) => digits.startsWith(p));
  });
}
