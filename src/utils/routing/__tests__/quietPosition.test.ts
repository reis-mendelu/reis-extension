import { describe, it, expect, afterEach, vi } from 'vitest';
import { quietPosition } from '../quietPosition';

// Parked with the rest of campus navigation: no plugin, so nothing to ask.
describe('quietPosition while navigation is parked', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('knows nothing', async () => {
    vi.stubGlobal('window', { location: { search: '' } } as unknown as Window);
    expect(await quietPosition()).toBeNull();
  });

  it('still takes the dev override', async () => {
    vi.stubGlobal('window', { location: { search: '?at=49.21,16.61' } } as unknown as Window);
    expect(await quietPosition()).toEqual([16.61, 49.21]);
  });
});
