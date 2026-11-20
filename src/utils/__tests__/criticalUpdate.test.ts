import { describe, it, expect } from 'vitest';
import {
  criticalUpdateApplies,
  shouldShowCriticalPopup,
  nextPopupLog,
  versionFromAndroidCode,
  dayKey,
  CRITICAL_POPUP_MAX,
  type CriticalVersion,
} from '../criticalUpdate';

const critical: CriticalVersion = {
  minVersion: '5.7.0',
  reason: { cz: 'IS změnil vzhled.', en: 'IS changed its look.' },
};
const now = new Date('2026-11-21T10:00:00Z');
const twoDaysAgo = new Date(now.getTime() - 2 * 86_400_000).toISOString();

const iosOffers = (version: string, released = twoDaysAgo) => ({
  updateAvailability: 2,
  availableVersionName: version,
  availableVersionReleaseDate: released,
});

describe('criticalUpdateApplies', () => {
  it('applies to an install below the critical version when the store has the fix', () => {
    expect(criticalUpdateApplies('5.6.0', critical, iosOffers('5.8.0'), 'ios', now)).toBe(true);
  });

  it('never applies without a critical version', () => {
    expect(criticalUpdateApplies('5.6.0', null, iosOffers('5.8.0'), 'ios', now)).toBe(false);
  });

  it('never applies to the critical version itself or anything newer', () => {
    expect(criticalUpdateApplies('5.7.0', critical, iosOffers('5.8.0'), 'ios', now)).toBe(false);
    expect(criticalUpdateApplies('5.8.0', critical, iosOffers('5.8.0'), 'ios', now)).toBe(false);
  });

  it('compares versions as numbers, so 5.10.0 is newer than 5.9.0', () => {
    const c = { ...critical, minVersion: '5.10.0' };
    expect(criticalUpdateApplies('5.9.0', c, iosOffers('5.10.1'), 'ios', now)).toBe(true);
    expect(
      criticalUpdateApplies(
        '5.10.0',
        { ...critical, minVersion: '5.9.0' },
        iosOffers('5.10.1'),
        'ios',
        now
      )
    ).toBe(false);
  });

  it('stays quiet while an unknown build version is reported', () => {
    expect(criticalUpdateApplies('0.0.0', critical, iosOffers('5.8.0'), 'ios', now)).toBe(false);
  });

  it('stays quiet while the store has no update to give', () => {
    expect(criticalUpdateApplies('5.6.0', critical, { updateAvailability: 1 }, 'ios', now)).toBe(
      false
    );
  });

  it('on iOS, stays quiet while the store still offers a version below the critical one', () => {
    expect(criticalUpdateApplies('5.5.0', critical, iosOffers('5.6.0'), 'ios', now)).toBe(false);
  });

  it('on iOS, waits a day after a store release: the lookup can run ahead of the download', () => {
    const anHourAgo = new Date(now.getTime() - 3_600_000).toISOString();
    expect(
      criticalUpdateApplies('5.6.0', critical, iosOffers('5.8.0', anHourAgo), 'ios', now)
    ).toBe(false);
  });

  it('on iOS, stays quiet when this iPhone cannot install the offered version', () => {
    const needs18 = { ...iosOffers('5.8.0'), minimumOsVersion: '18.0' };
    expect(criticalUpdateApplies('5.6.0', critical, needs18, 'ios', now, '17.4')).toBe(false);
    expect(criticalUpdateApplies('5.6.0', critical, needs18, 'ios', now, '18.1')).toBe(true);
    // Unknown iOS version: no way to tell, so the store's answer stands.
    expect(criticalUpdateApplies('5.6.0', critical, needs18, 'ios', now, null)).toBe(true);
  });

  it('on Android, reads the version from the Play version code', () => {
    const play = (code: string) => ({ updateAvailability: 2, availableVersionCode: code });
    expect(criticalUpdateApplies('5.6.0', critical, play('50800'), 'android', now)).toBe(true);
    expect(criticalUpdateApplies('5.5.0', critical, play('50600'), 'android', now)).toBe(false);
    expect(
      criticalUpdateApplies('5.6.0', critical, { updateAvailability: 2 }, 'android', now)
    ).toBe(false);
  });
});

describe('versionFromAndroidCode', () => {
  it('undoes major*10000 + minor*100 + patch (android/app/build.gradle)', () => {
    expect(versionFromAndroidCode('50005')).toBe('5.0.5');
    expect(versionFromAndroidCode('51002')).toBe('5.10.2');
    expect(versionFromAndroidCode('nonsense')).toBeNull();
  });
});

describe('shouldShowCriticalPopup', () => {
  it('shows the first time a critical version is seen', () => {
    expect(shouldShowCriticalPopup(null, '5.7.0', '2026-11-21')).toBe(true);
  });

  it('does not show again the same day', () => {
    const log = nextPopupLog(null, '5.7.0', '2026-11-21');
    expect(shouldShowCriticalPopup(log, '5.7.0', '2026-11-21')).toBe(false);
  });

  it('shows once more on a later day, then never again', () => {
    let log = nextPopupLog(null, '5.7.0', '2026-11-21');
    expect(shouldShowCriticalPopup(log, '5.7.0', '2026-11-22')).toBe(true);
    log = nextPopupLog(log, '5.7.0', '2026-11-22');
    expect(log.shown).toBe(CRITICAL_POPUP_MAX);
    expect(shouldShowCriticalPopup(log, '5.7.0', '2026-11-30')).toBe(false);
  });

  it('starts over for a new critical version', () => {
    let log = nextPopupLog(null, '5.7.0', '2026-11-21');
    log = nextPopupLog(log, '5.7.0', '2026-11-22');
    expect(shouldShowCriticalPopup(log, '6.0.0', '2026-11-22')).toBe(true);
    expect(nextPopupLog(log, '6.0.0', '2026-11-22').shown).toBe(1);
  });
});

describe('dayKey', () => {
  it('is the local calendar day', () => {
    expect(dayKey(new Date(2026, 10, 21, 23, 59))).toBe('2026-11-21');
  });
});
