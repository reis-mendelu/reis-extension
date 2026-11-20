import { describe, it, expect } from 'vitest';
import { appUpdateOffer, UPDATE_GRACE_DAYS } from '../appUpdateOffer';

const NOW = new Date('2026-11-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();

const ios = (o: Record<string, unknown> = {}) => ({
  updateAvailability: 2,
  currentVersionName: '5.6.0',
  availableVersionName: '5.8.0',
  availableVersionReleaseDate: daysAgo(4),
  minimumOsVersion: '15.0',
  ...o,
});
const android = (o: Record<string, unknown> = {}) => ({
  updateAvailability: 2,
  currentVersionName: '5.6.0',
  availableVersionCode: '50800',
  clientVersionStalenessDays: 4,
  ...o,
});

describe('appUpdateOffer', () => {
  it('offers a newer App Store version once it has been out a few days', () => {
    expect(appUpdateOffer(ios(), 'ios', NOW, '18.1')).toEqual({
      id: 'app-update:5.8.0',
      version: '5.8.0',
    });
  });

  it('waits while most phones are still updating on their own', () => {
    expect(UPDATE_GRACE_DAYS).toBe(3);
    expect(
      appUpdateOffer(ios({ availableVersionReleaseDate: daysAgo(1) }), 'ios', NOW, '18.1')
    ).toBeNull();
    expect(appUpdateOffer(android({ clientVersionStalenessDays: 2 }), 'android', NOW)).toBeNull();
    // Play reports no staleness until it has learnt of the update.
    expect(
      appUpdateOffer(android({ clientVersionStalenessDays: undefined }), 'android', NOW)
    ).toBeNull();
  });

  it('says nothing when the app is current, or the store could not tell', () => {
    expect(appUpdateOffer(ios({ updateAvailability: 1 }), 'ios', NOW, '18.1')).toBeNull();
    expect(appUpdateOffer(android({ updateAvailability: 0 }), 'android', NOW)).toBeNull();
    // An update Play is already installing is not news.
    expect(appUpdateOffer(android({ updateAvailability: 3 }), 'android', NOW)).toBeNull();
  });

  it('never offers what this iPhone cannot install', () => {
    expect(appUpdateOffer(ios({ minimumOsVersion: '17.0' }), 'ios', NOW, '16.7')).toBeNull();
    expect(appUpdateOffer(ios({ minimumOsVersion: '17.0' }), 'ios', NOW, '17.0')).not.toBeNull();
    // Unknown OS version: the store's own check applies at install; offer it.
    expect(appUpdateOffer(ios({ minimumOsVersion: '17.0' }), 'ios', NOW, null)).not.toBeNull();
  });

  it('names an Android offer by its version code (Play gives no version name)', () => {
    expect(appUpdateOffer(android(), 'android', NOW)).toEqual({
      id: 'app-update:50800',
      version: null,
    });
  });

  it('ignores a bad release date rather than offering', () => {
    expect(
      appUpdateOffer(ios({ availableVersionReleaseDate: 'soon' }), 'ios', NOW, '18.1')
    ).toBeNull();
  });
});
