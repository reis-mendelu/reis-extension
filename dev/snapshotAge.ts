import { shouldLoadRealData } from './bootDemoMode';
import type { HarnessEnv } from '../src/utils/harnessEnabled';
import { DEMO_BANNER_HEIGHT } from '../src/components/mobile/toastOffset';

const ELEMENT_ID = 'reis-snapshot-age';
const MS_PER_DAY = 86_400_000;

/**
 * How stale the real-data preview is, in words.
 *
 * `lastSync` is whatever the snapshot actually carries: the top-level
 * `lastSync` field in `preview-data.json` / `dev-real-data.json` is a numeric
 * epoch-ms timestamp (confirmed against the real file), not an ISO string, so
 * both shapes are accepted directly — `new Date(n)` handles the number
 * correctly, whereas stringifying it first (`String(n)`) produces an Invalid
 * Date and would wrongly report "unknown".
 *
 * `JSON.parse` returns `any`, so the `string | number` shape isn't policed at
 * runtime — a malformed snapshot can hand back `null`, `0`, an empty string,
 * a negative number, or a non-finite number, and `new Date(null)` /
 * `new Date(0)` are valid, non-NaN dates that `Number.isNaN` alone would not
 * catch. All of those, plus a timestamp in the future, are treated as
 * "unknown" rather than rendered as a fabricated day count — the one answer
 * that would actively mislead.
 */
export function formatSnapshotAge(
  lastSync: string | number | null | undefined,
  now: Date
): string {
  if (lastSync === null || lastSync === undefined) return 'snapshot date unknown';
  if (typeof lastSync === 'number' && (!Number.isFinite(lastSync) || lastSync <= 0)) {
    return 'snapshot date unknown';
  }

  const then = new Date(lastSync);
  const thenMs = then.getTime();
  if (Number.isNaN(thenMs) || thenMs > now.getTime()) return 'snapshot date unknown';

  const days = Math.floor((now.getTime() - thenMs) / MS_PER_DAY);
  if (days <= 0) return 'data scraped today';
  if (days === 1) return 'data scraped 1 day ago';
  return `data scraped ${days} days ago`;
}

/**
 * Where the badge sits, vertically.
 *
 * `DemoBanner` (`src/components/mobile/DemoBanner.tsx`) is always the topmost
 * element while demo mode is on, which it is for the whole duration of this
 * real-data preview (see `bootDemoMode.ts`) — so a `top-0` badge collides with
 * it on every real-data preview visit, not as an edge case.
 *
 * This is the same problem `toastOffset.ts` already solved for the Toaster,
 * which sits on top of the same banner: clear `--safe-top` plus the banner's
 * own known box height (`DEMO_BANNER_HEIGHT`), not a DOM measurement. An
 * earlier version of this function measured the painted banner once at mount
 * with `elementFromPoint` + an ancestor walk — a fixed px value that couldn't
 * react to anything afterward. This one returns a CSS `calc()` referencing
 * `var(--safe-top, ...)`, which the browser re-evaluates on every layout, so a
 * viewport resize or a safe-area change on rotation can never make it stale —
 * unlike the old measured px, this is correct by construction, not because it
 * gets recomputed. It's also plain data, testable without a DOM at all.
 *
 * It does not, on its own, cover `DemoBanner` unmounting later (the student
 * exiting demo) — `mountSnapshotAge` below reads `demoMode` once at boot onto
 * a plain DOM node and never revisits it. That's fine only because
 * `bootDemoMode.ts` documents demo mode as staying on for the whole duration
 * of the real-data preview; if that invariant ever changes, this would need
 * to become reactive too.
 */
export function badgeTop(demoMode: boolean): string {
  return demoMode ? `calc(var(--safe-top, 0px) + ${DEMO_BANNER_HEIGHT})` : '0px';
}

/**
 * Paints the age on the real-data preview only.
 *
 * That build is refreshed by hand, so a three-week-old snapshot is
 * indistinguishable from a fresh one without this. The demo preview carries no
 * chrome of its own by design — this is the exception, and it earns it.
 *
 * `demoMode` is passed in rather than read from the store here, so this stays
 * a plain function of its arguments — see `badgeTop` above for why that
 * matters. The real-data preview has demo mode on for its whole duration
 * (`bootDemoMode.ts`), so callers should pass `isDemoMode()` from
 * `src/errors/demoMode.ts`.
 */
export function mountSnapshotAge(
  env: HarnessEnv & { VITE_PREVIEW_DATA?: string },
  lastSync: string | number | null | undefined,
  demoMode: boolean,
  doc: Document = document
): void {
  if (!shouldLoadRealData(env)) return;
  if (doc.getElementById(ELEMENT_ID)) return;

  const el = doc.createElement('div');
  el.id = ELEMENT_ID;
  el.dataset.testid = 'snapshot-age';
  el.className =
    'fixed right-0 z-50 bg-base-300 text-base-content/70 text-[10px] px-2 py-0.5 rounded-bl';
  // Not a Tailwind class: `--safe-top` is a runtime CSS custom property, so
  // this one value can't be expressed as a utility class. Every other visual
  // property above stays a Tailwind/DaisyUI utility.
  el.style.top = badgeTop(demoMode);
  el.textContent = formatSnapshotAge(lastSync, new Date());
  doc.body.appendChild(el);
}
