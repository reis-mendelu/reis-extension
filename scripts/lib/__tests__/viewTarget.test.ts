import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planView, screenTestId, isMobileTab, VIEW_NAMES } from '../viewTarget';
import { MOBILE_TABS } from '../../../src/store/types';
import { APP_VIEWS } from '../../../src/types/app';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');

describe('planView', () => {
  it('drives the phone tab for every mobile view at a phone width', () => {
    // The regression itself: each of these was a no-op that photographed the
    // calendar, and a five-view sweep read as five views of coverage.
    for (const tab of MOBILE_TABS) {
      expect(planView(tab, 'phone')).toEqual({
        kind: 'mobile-tab',
        tab,
        testId: `${tab}-screen`,
      });
    }
  });

  it('gives every mobile view a DISTINCT screen to prove it rendered', () => {
    const ids = MOBILE_TABS.map((t) => planView(t, 'phone'))
      .filter((p) => p.kind === 'mobile-tab')
      .map((p) => (p as { testId: string }).testId);
    expect(new Set(ids).size).toBe(MOBILE_TABS.length);
  });

  it('leaves the desktop shell on the seeded view', () => {
    expect(planView('exams', 'desktop').kind).toBe('seed-only');
    expect(planView('studyPlan', 'desktop').kind).toBe('seed-only');
    expect(planView('settings', 'desktop').kind).toBe('seed-only');
  });

  it('refuses a desktop-only view at a phone width instead of shooting the calendar', () => {
    for (const view of ['settings', 'studyPlan', 'erasmus', 'timeline-demo']) {
      const plan = planView(view, 'phone');
      expect(plan.kind).toBe('impossible');
      expect((plan as { message: string }).message).toContain(view);
    }
  });

  it('refuses a view the app does not have', () => {
    expect(planView('exmas', 'phone').kind).toBe('impossible');
    expect(planView('exmas', 'desktop').kind).toBe('impossible');
  });

  it('drives the tab when both shells mounted, but lets a desktop view through', () => {
    expect(planView('map', 'both').kind).toBe('mobile-tab');
    expect(planView('studyPlan', 'both').kind).toBe('seed-only');
  });

  it('refuses a phone tab when no shell ever mounted', () => {
    // The timeout-shaped version of the original bug: a blank or slow-booting
    // app reads as `none`, and a permissive `none` would shoot whichever tab
    // the app started on and call it the requested view.
    for (const tab of MOBILE_TABS) {
      expect(planView(tab, 'none').kind).toBe('impossible');
    }
  });

  it('still lets a shell-less target through for a desktop view (the admin console)', () => {
    expect(planView('settings', 'none').kind).toBe('seed-only');
    expect(planView(undefined, 'none').kind).toBe('seed-only');
    expect(planView(undefined, 'phone').kind).toBe('seed-only');
  });
});

describe('the --view vocabulary', () => {
  it('accepts every app view and every phone tab', () => {
    for (const v of [...APP_VIEWS, ...MOBILE_TABS]) expect(VIEW_NAMES).toContain(v);
  });

  it('classifies the five phone tabs and nothing else as tabs', () => {
    expect(MOBILE_TABS.filter(isMobileTab)).toEqual([...MOBILE_TABS]);
    expect(isMobileTab('studyPlan')).toBe(false);
  });
});

describe('the screen testids this plan asserts against', () => {
  // A sixth tab added to MOBILE_TABS without a `data-testid` in its screen
  // would make planView promise proof it cannot obtain — the run would fail
  // on a screen that is rendering perfectly. Pin the two together here so
  // that lands in CI rather than in a release sweep.
  it('exists in the phone screen components, one per tab', () => {
    for (const tab of MOBILE_TABS) {
      const file = resolve(
        ROOT,
        `src/components/mobile/screens/${tab[0]!.toUpperCase()}${tab.slice(1)}Screen.tsx`
      );
      expect(readFileSync(file, 'utf8')).toContain(`data-testid="${screenTestId(tab)}"`);
    }
  });
});
