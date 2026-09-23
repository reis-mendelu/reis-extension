import { describe, it, expect } from 'vitest';
import { resolveVenueChoice } from '../venueMapUrl';

const MYSTICA: [number, number] = [16.5952946, 49.2235078];

/**
 * Whether a venue tap asks which map app to use. There is no remembered
 * choice any more: iOS asks every time, and Android never does because its
 * `geo:` URL is itself the system chooser.
 */
describe('resolveVenueChoice', () => {
  it('asks on iOS, every time', () => {
    expect(resolveVenueChoice(MYSTICA, 'Mystica', 'ios')).toBeNull();
  });

  it('never asks on Android, because the system does', () => {
    const url = resolveVenueChoice(MYSTICA, 'Mystica', 'android');
    expect(url?.startsWith('geo:')).toBe(true);
  });
});
