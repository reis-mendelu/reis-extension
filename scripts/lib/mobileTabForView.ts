import { MOBILE_TABS, type MobileTab } from '../../src/store/types';
import { APP_VIEWS } from '../../src/types/app';

/**
 * Which phone tab a `--view` names, or null when the phone has no such screen.
 *
 * `--view` is seeded into `meta.reis_current_view`, and that key drives the
 * DESKTOP tree only: the phone shell keeps its tab in `mobileTab` on
 * `createMobileUiSlice`, which is initialised to `'calendar'` and read from no
 * store at all. So a phone-width run with `--view map` used to photograph the
 * Calendar and report it clean — a finding-free report about a screen nobody
 * asked for, which is the one failure this whole script exists to prevent.
 *
 * Pure and unit-tested rather than inline in `shot.ts`, per the skill's own
 * rule about where judgement lives, and derived from `MOBILE_TABS` so a tab
 * added to the phone cannot be forgotten here.
 *
 * The two lists are not the same list, and the difference is the point:
 *   - `settings`, `studyPlan`, `erasmus`, `timeline-demo` are desktop views
 *     with no phone tab. They return null so the caller can FAIL rather than
 *     quietly render the Calendar.
 *   - `profile` is a phone tab with no desktop view, and is accepted: a phone
 *     run is entitled to name a phone screen.
 */
export function mobileTabForView(view: string): MobileTab | null {
  return (MOBILE_TABS as readonly string[]).includes(view) ? (view as MobileTab) : null;
}

/** Views this script accepts at a phone width, for an error message that tells
 *  the reader what to type instead of only what was wrong. */
export function phoneViewNames(): string {
  return [...MOBILE_TABS].join(', ');
}

/** True for a view the DESKTOP tree knows — used to tell "no phone tab for a
 *  real view" apart from "that is not a view at all", which are different
 *  mistakes and deserve different advice. */
export function isDesktopOnlyView(view: string): boolean {
  return (APP_VIEWS as readonly string[]).includes(view) && mobileTabForView(view) === null;
}
