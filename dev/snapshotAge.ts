import { shouldLoadRealData } from './bootDemoMode';
import type { HarnessEnv } from '../src/utils/harnessEnabled';

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
 * An unreadable date returns "unknown" rather than falling back to "today" —
 * the one answer that would actively mislead.
 */
export function formatSnapshotAge(lastSync: string | number, now: Date): string {
  const then = new Date(lastSync);
  if (Number.isNaN(then.getTime())) return 'snapshot date unknown';

  const days = Math.floor((now.getTime() - then.getTime()) / MS_PER_DAY);
  if (days <= 0) return 'data scraped today';
  if (days === 1) return 'data scraped 1 day ago';
  return `data scraped ${days} days ago`;
}

// Anything shorter than this counts as a "banner", not the app shell itself —
// tuned well above DemoBanner's real ~32px so a wrapped two-line label still
// counts, and well below a full-height container.
const BANNER_HEIGHT_CEILING_PX = 200;
// How close to the very top edge an element has to start to count as
// "occupying the top" — a few px of slack for sub-pixel layout rounding.
const TOP_EDGE_SLACK_PX = 4;

/**
 * How much vertical space, in px, is already occupied at the very top of the
 * screen — so the badge can render below it instead of on top of it.
 *
 * `DemoBanner` (`src/components/mobile/DemoBanner.tsx`) is always the topmost
 * element while demo mode is on, which it is for the whole duration of this
 * real-data preview (see `bootDemoMode.ts`) — so a `top-0` badge collides
 * with it on every real-data preview visit, not as an edge case. Its height
 * isn't static: it grows with the device's safe-area inset and with which of
 * CZ/EN's banner labels is longer. Measuring it beats guessing a fixed
 * offset — a hardcoded value that happens to clear it on one device is
 * exactly the kind of fix that broke on the next screen size (see the
 * bottom-nav-pill collision this project already shipped once).
 *
 * Walks up from whatever is actually painted at the probe point rather than
 * trusting a single hit test, because the element `elementFromPoint` returns
 * is often a piece of the banner's content (a label, a button) narrower than
 * the banner itself — its ancestor is the full-width bar whose height
 * actually needs to be cleared. The height ceiling stops that walk at the
 * app shell's own full-height container, which also starts at the top edge
 * and would otherwise report the entire viewport as "occupied".
 */
function topClearance(doc: Document): number {
  const view = doc.defaultView;
  if (!view) return 0;
  const probe = doc.elementFromPoint(view.innerWidth - 10, TOP_EDGE_SLACK_PX);
  let bottom = 0;
  let el: Element | null = probe;
  while (el && el !== doc.body && el !== doc.documentElement) {
    const rect = el.getBoundingClientRect();
    if (
      rect.top <= TOP_EDGE_SLACK_PX &&
      rect.height > 0 &&
      rect.height < BANNER_HEIGHT_CEILING_PX
    ) {
      bottom = Math.max(bottom, rect.bottom);
    }
    el = el.parentElement;
  }
  return bottom;
}

/**
 * Paints the age on the real-data preview only.
 *
 * That build is refreshed by hand, so a three-week-old snapshot is
 * indistinguishable from a fresh one without this. The demo preview carries no
 * chrome of its own by design — this is the exception, and it earns it.
 */
export function mountSnapshotAge(
  env: HarnessEnv & { VITE_PREVIEW_DATA?: string },
  lastSync: string | number | undefined,
  doc: Document = document
): void {
  if (!shouldLoadRealData(env)) return;
  if (doc.getElementById(ELEMENT_ID)) return;

  const el = doc.createElement('div');
  el.id = ELEMENT_ID;
  el.dataset.testid = 'snapshot-age';
  el.className =
    'fixed right-0 z-50 bg-base-300 text-base-content/70 text-[10px] px-2 py-0.5 rounded-bl';
  // Not a Tailwind class: the offset is a runtime measurement (see
  // topClearance), not a design-time constant, so it cannot be expressed as
  // one. Every other visual property above stays a Tailwind/DaisyUI utility.
  el.style.top = `${topClearance(doc)}px`;
  el.textContent =
    lastSync !== undefined ? formatSnapshotAge(lastSync, new Date()) : 'snapshot date unknown';
  doc.body.appendChild(el);
}
