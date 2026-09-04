import { describe, it, expect } from 'vitest';
import { venueMapUrl } from '../venueMapUrl';

// coord is [lng, lat] everywhere in this app; every maps URL wants lat,lng.
// Getting that backwards puts a Brno venue in the Indian Ocean, and it is the
// single easiest mistake to make here, so it is asserted on every platform.
const MYSTICA: [number, number] = [16.5952946, 49.2235078];

describe('venueMapUrl', () => {
  // A `maps:` navigation is what actually reaches Apple Maps. Capacitor's iOS
  // delegate cancels any top-level navigation that is not the app's own URL and
  // hands it to `UIApplication.shared.open` — so a custom scheme opens the app,
  // while an https URL opened through the in-app browser only ever RENDERS
  // maps.google.com, which is the bug this fixes.
  it('opens Apple Maps on iOS, with the venue named', () => {
    const url = venueMapUrl(MYSTICA, 'Mystica', 'ios');
    expect(url.startsWith('maps://')).toBe(true);
    expect(url).toContain('ll=49.2235078,16.5952946');
    expect(url).toContain('q=Mystica');
  });

  it('hands Android a geo: URI so the system offers its map apps', () => {
    const url = venueMapUrl(MYSTICA, 'Mystica', 'android');
    expect(url.startsWith('geo:49.2235078,16.5952946')).toBe(true);
    expect(url).toContain('(Mystica)');
  });

  // The extension and the dev webapp have no native app to hand off to.
  it('keeps the Google Maps web URL everywhere else', () => {
    const url = venueMapUrl(MYSTICA, 'Mystica', 'web');
    expect(url).toBe('https://www.google.com/maps/search/?api=1&query=49.2235078,16.5952946');
  });

  // Venue names come from a society's own typing, so they carry spaces,
  // diacritics and the occasional ampersand. Unencoded, an "&" silently
  // truncates the label — or worse, injects a parameter.
  it('encodes a venue name that would otherwise break the URL', () => {
    const ios = venueMapUrl(MYSTICA, 'Bar & Books, Kounicova', 'ios');
    expect(ios).not.toContain('& Books');
    expect(decodeURIComponent(new URL(ios).searchParams.get('q') ?? '')).toBe(
      'Bar & Books, Kounicova'
    );
  });

  // A parenthesis in the label would close geo:'s own label delimiter early.
  it('keeps a bracket in the label from breaking the geo: URI', () => {
    const url = venueMapUrl(MYSTICA, 'Klub (starý)', 'android');
    expect(url).toContain('%28star%C3%BD%29');
  });

  it('falls back to the coordinates when the venue has no name', () => {
    const q = new URL(venueMapUrl(MYSTICA, '', 'ios')).searchParams.get('q');
    expect(q).toBe('49.2235078,16.5952946');
  });
});
