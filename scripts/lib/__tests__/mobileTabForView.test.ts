import { describe, it, expect } from 'vitest';
import { mobileTabForView, isDesktopOnlyView, phoneViewNames } from '../mobileTabForView';
import { MOBILE_TABS } from '../../../src/store/types';
import { APP_VIEWS } from '../../../src/types/app';

describe('mobileTabForView', () => {
  it('maps every view the phone and the desktop share', () => {
    expect(mobileTabForView('calendar')).toBe('calendar');
    expect(mobileTabForView('exams')).toBe('exams');
    expect(mobileTabForView('subjects')).toBe('subjects');
    // The one from the bug report: `--view map` used to render the Calendar.
    expect(mobileTabForView('map')).toBe('map');
  });

  it('accepts a phone-only tab', () => {
    // `profile` is not an AppView — the desktop has no such screen — but a
    // phone-width run is entitled to name a phone screen.
    expect(APP_VIEWS as readonly string[]).not.toContain('profile');
    expect(mobileTabForView('profile')).toBe('profile');
  });

  it('returns null for a desktop view the phone has no tab for', () => {
    for (const view of ['settings', 'studyPlan', 'erasmus', 'timeline-demo']) {
      expect(mobileTabForView(view)).toBeNull();
      expect(isDesktopOnlyView(view)).toBe(true);
    }
  });

  it('returns null for a string that is not a view at all', () => {
    expect(mobileTabForView('')).toBeNull();
    expect(mobileTabForView('mpa')).toBeNull();
    expect(isDesktopOnlyView('mpa')).toBe(false);
  });

  it('covers every phone tab, so a new tab cannot be forgotten here', () => {
    for (const tab of MOBILE_TABS) expect(mobileTabForView(tab)).toBe(tab);
  });

  it('names the accepted views for the error message', () => {
    for (const tab of MOBILE_TABS) expect(phoneViewNames()).toContain(tab);
  });
});
