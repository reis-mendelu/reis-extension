/**
 * Deciding what `verify:ui --view X` actually means at the width being measured.
 *
 * The desktop tree and the phone tree read DIFFERENT state for "which screen is
 * on". The desktop tree restores `meta.reis_current_view` at boot
 * (`useAppLogic`), so seeding that key is enough there. The phone tree routes on
 * `mobileTab` from `createMobileUiSlice` (`MobileApp`), which that key does not
 * touch at all — so at the default 320/390/430 widths `--view exams` used to be
 * a NO-OP that photographed the calendar and reported no findings. A five-view
 * sweep produced fifteen images of one screen and read as full coverage; the
 * only tell was that every light-theme run flagged the same "Kalendář" element
 * whatever view had been asked for.
 *
 * Kept out of `shot.ts` and out of the browser so it can be tested. A guard
 * nobody tests is exactly as trustworthy as the false-green it exists to catch.
 */

import { MOBILE_TABS, type MobileTab } from '../../src/store/types';
import { APP_VIEWS } from '../../src/types/app';
import type { Shell } from './uiFindings';

/** Every name `--view` legitimately accepts: the desktop views plus the phone
 *  tabs. They overlap on five names; `profile` is a phone tab and no desktop
 *  view, `settings`/`studyPlan`/`erasmus`/`timeline-demo` the other way round. */
export const VIEW_NAMES: readonly string[] = [...new Set<string>([...APP_VIEWS, ...MOBILE_TABS])];

export function isMobileTab(view: string): view is MobileTab {
  return (MOBILE_TABS as readonly string[]).includes(view);
}

/**
 * The element the phone shell renders for a tab. `MobileApp` mounts exactly one
 * of these, so its presence is proof the requested screen is the one on screen —
 * which is a stronger claim than reading `mobileTab` back out of the store, and
 * it is the claim the old bug could not make.
 */
export function screenTestId(tab: MobileTab): string {
  return `${tab}-screen`;
}

export type ViewPlan =
  /** Nothing to drive: the seeded `reis_current_view` is what selects the screen. */
  | { kind: 'seed-only'; why: string }
  /** Drive the phone shell's tab through the store handle, then prove it rendered. */
  | { kind: 'mobile-tab'; tab: MobileTab; testId: string }
  /** The run cannot show what was asked for. Never a warning — see the note below. */
  | { kind: 'impossible'; message: string };

/**
 * Decide how `--view` should be honoured against the shell that actually
 * mounted.
 *
 * `impossible` rather than a warning, everywhere it appears: this tool's one
 * catastrophic failure mode is reporting a clean page it never put into the
 * state under test, and a warning printed among a run's normal output is how
 * that failure mode survives for months. A screenshot that cannot show the
 * requested view is worth less than no screenshot at all.
 *
 * `none` is deliberately permissive. Neither shell testid is present in the
 * admin console, which is a legitimate `verify:ui` target — failing it here
 * would break a working workflow to guard a screen it does not have.
 */
export function planView(view: string | undefined, shell: Shell): ViewPlan {
  if (!view) return { kind: 'seed-only', why: 'no --view was passed' };

  if (shell === 'none') {
    return {
      kind: 'seed-only',
      why: 'no app shell mounted — not a screen this plan can reason about',
    };
  }

  if (!VIEW_NAMES.includes(view)) {
    return {
      kind: 'impossible',
      message:
        `--view "${view}" is not a view this app has. Known views: ${VIEW_NAMES.join(', ')}. ` +
        'An unknown value is silently ignored at boot, so the run would have photographed ' +
        'the default screen under the name you asked for.',
    };
  }

  if (isMobileTab(view)) {
    if (shell === 'desktop') {
      return {
        kind: 'seed-only',
        why: `the desktop shell restores reis_current_view=${view} itself`,
      };
    }
    return { kind: 'mobile-tab', tab: view, testId: screenTestId(view) };
  }

  // A desktop-only view below the phone breakpoint. `both` still has a desktop
  // tree mounted for it; a bare `phone` does not, and nothing on screen would
  // be the screen that was asked for.
  if (shell === 'phone') {
    return {
      kind: 'impossible',
      message:
        `--view "${view}" is a desktop-only view, but the phone shell rendered. The phone tree ` +
        `has five tabs (${MOBILE_TABS.join(', ')}) and no "${view}" screen at all, so this run ` +
        'would have photographed the calendar. Use --widths 1024,1440 and --url <url>?mobile=0.',
    };
  }
  return { kind: 'seed-only', why: `"${view}" is a desktop view and the desktop tree is mounted` };
}
