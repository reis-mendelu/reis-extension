import { describe, it, expect } from 'vitest';
import { venueMapChoices } from '../venueMapUrl';

const MYSTICA: [number, number] = [16.5952946, 49.2235078];

describe('venueMapChoices', () => {
  // Android's `geo:` IS the chooser — the system offers whichever map apps are
  // installed. Presenting our own list on top of it would be a menu that opens
  // a menu.
  it('gives Android a single option, because the system already asks', () => {
    const choices = venueMapChoices(MYSTICA, 'Mystica', 'android');
    expect(choices).toHaveLength(1);
    expect(choices[0]!.url.startsWith('geo:')).toBe(true);
  });

  // iOS has no system chooser: `maps:` goes straight to Apple Maps and nothing
  // asks. So the choice has to be offered in the app.
  it('offers Apple and Google on iOS', () => {
    const choices = venueMapChoices(MYSTICA, 'Mystica', 'ios');
    expect(choices.map((c) => c.id)).toEqual(['apple', 'google']);
    expect(choices[0]!.url.startsWith('maps://')).toBe(true);
  });

  // Google's entry is an https URL ON PURPOSE, not `comgooglemaps://`. The
  // scheme needs `LSApplicationQueriesSchemes` in Info.plist to even be
  // testable, and opening one that is not installed does nothing at all — a
  // dead tap. iOS hands this universal link to the Google Maps app when it is
  // there and to Safari when it is not, so the option always does something.
  it('routes Google through a universal link so it cannot be a dead tap', () => {
    const google = venueMapChoices(MYSTICA, 'Mystica', 'ios')[1]!;
    expect(google.url.startsWith('https://')).toBe(true);
    expect(google.url).toContain('49.2235078,16.5952946');
  });

  it('gives the web one option, the same Google URL as before', () => {
    const choices = venueMapChoices(MYSTICA, 'Mystica', 'web');
    expect(choices).toHaveLength(1);
    expect(choices[0]!.url).toBe(
      'https://www.google.com/maps/search/?api=1&query=49.2235078,16.5952946'
    );
  });
});
