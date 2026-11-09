import fragment from '../src/api/__tests__/fixtures/sklub-pixie-page4.fragment.txt?raw';
import { parseSklubMenu } from '../src/api/sklubMenu';
import { addDays, daysBetween, pragueClock } from '../src/utils/venues/venueStatus';
import { useAppStore } from '../src/store/useAppStore';
import type { VenueLunchDay } from '../src/types/campusMap';

/**
 * Give the dev webapp S-klub's week, as menuSeed.ts gives it SKM's: the real
 * page goes through the content-script proxy, which does not exist here.
 *
 * Parsed from the parser's own committed capture and moved, whole weeks at a
 * time, onto the current week, so weekdays stay weekdays. Stamped fresh, so a
 * venue load never asks the missing proxy for it.
 *
 * The S-klub tab and the card's dishes also need the café in `venuePins`,
 * which the dev webapp only has once the release creates the table; verify:ui
 * seeds it (`--seed-store`, from `src/test/fixtures/sklubVenueRow.ts`).
 *
 * DEV-gated and in `dev/`, so it cannot reach the extension or the apps.
 */
export function rebaseSklubWeek(days: VenueLunchDay[], now: Date): VenueLunchDay[] {
  if (days.length === 0) return [];
  const today = pragueClock(now);
  const thisMonday = addDays(today.date, 1 - today.day);
  const first = days[0]!.date;
  const weekday = (new Date(`${first}T12:00:00Z`).getUTCDay() + 6) % 7;
  const shift = daysBetween(addDays(first, -weekday), thisMonday);
  return days.map((d) => ({ ...d, date: addDays(d.date, shift) }));
}

if (import.meta.env.DEV) {
  const week = rebaseSklubWeek(parseSklubMenu(fragment), new Date());
  if (week.length && useAppStore.getState().sklubMenu.length === 0) {
    useAppStore.setState({ sklubMenu: week, sklubMenuFetchedAt: Date.now() });
  }
}
