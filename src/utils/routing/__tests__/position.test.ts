import { describe, it, expect, afterEach, vi } from 'vitest';
import { currentPosition, isPermissionDenied, NO_PLATFORM } from '../position';

/**
 * Campus navigation is parked and the Geolocation plugin is uninstalled, so
 * nothing here can raise a location prompt. What is left is the dev override
 * and a "no platform" answer, which the route slice reports as unavailable —
 * never as a refusal the student did not make.
 */
describe('currentPosition while navigation is parked', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('answers no platform', async () => {
    vi.stubGlobal('window', { location: { search: '' } } as unknown as Window);
    await expect(currentPosition()).rejects.toThrow(NO_PLATFORM);
  });

  it('is not mistaken for a refusal', async () => {
    vi.stubGlobal('window', { location: { search: '' } } as unknown as Window);
    await expect(currentPosition()).rejects.not.toSatisfy(isPermissionDenied);
  });

  it('still takes the dev override, so the harness can draw a walk', async () => {
    vi.stubGlobal('window', { location: { search: '?at=49.21,16.61' } } as unknown as Window);
    expect(await currentPosition()).toEqual([16.61, 49.21]);
  });
});
