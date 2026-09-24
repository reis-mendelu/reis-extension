import { describe, it, expect } from 'vitest';
import { fixtureNow } from '../fixtureClock';

const REAL = new Date(2026, 8, 23, 23, 31, 0);

/**
 * `?now=10:30` on the dev webapp moves the app's clock (dev/clockOverride),
 * but the fixture's own lessons are stamped server-side — so the server has to
 * read the same param, or a lesson authored "running now" lands at 23:31 while
 * the app thinks it is half past ten.
 *
 * The app fetches `/dev-real-data.json` with no query of its own, so the param
 * arrives on the Referer: the page URL the fetch came from.
 */
describe('fixtureNow', () => {
  it('is the real clock when nothing asks otherwise', () => {
    expect(fixtureNow('/dev-real-data.json', undefined, REAL)).toEqual(REAL);
  });

  it('follows ?now= on the request itself', () => {
    expect(fixtureNow('/dev-real-data.json?now=10:30', undefined, REAL).getHours()).toBe(10);
  });

  it('follows ?now= on the page that asked', () => {
    const at = fixtureNow('/dev-real-data.json', 'http://localhost:3002/?mobile=1&now=08:15', REAL);
    expect([at.getHours(), at.getMinutes()]).toEqual([8, 15]);
  });

  it('ignores a referer that names no time', () => {
    expect(fixtureNow('/dev-real-data.json', 'http://localhost:3002/?mobile=1', REAL)).toEqual(
      REAL
    );
  });

  it('survives a referer that is not a URL', () => {
    expect(fixtureNow('/dev-real-data.json', 'not a url', REAL)).toEqual(REAL);
  });
});
