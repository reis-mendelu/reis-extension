import { describe, it, expect } from 'vitest';
import { resolveVenueChoice } from '../venueMapUrl';

const MYSTICA: [number, number] = [16.5952946, 49.2235078];

describe('resolveVenueChoice', () => {
  // With no preference the student is asked — but only where there is anything
  // to ask about. Android's `geo:` is already the chooser, so it resolves
  // straight to its single option however the preference is set.
  it('asks on iOS when nothing is remembered', () => {
    expect(resolveVenueChoice(MYSTICA, 'Mystica', 'ios', null)).toBeNull();
  });

  it('never asks on Android, because the system does', () => {
    const url = resolveVenueChoice(MYSTICA, 'Mystica', 'android', null);
    expect(url?.startsWith('geo:')).toBe(true);
  });

  it('goes straight to the remembered app', () => {
    expect(resolveVenueChoice(MYSTICA, 'Mystica', 'ios', 'apple')?.startsWith('maps://')).toBe(
      true
    );
    expect(resolveVenueChoice(MYSTICA, 'Mystica', 'ios', 'google')?.startsWith('https://')).toBe(
      true
    );
  });

  // A preference persisted by an older build, or hand-edited, must not wedge
  // the tap: an unknown id falls back to asking rather than resolving to
  // nothing and doing nothing.
  it('asks again if the remembered app is not one we offer', () => {
    expect(
      resolveVenueChoice(MYSTICA, 'Mystica', 'ios', 'waze' as unknown as 'apple')
    ).toBeNull();
  });
});
