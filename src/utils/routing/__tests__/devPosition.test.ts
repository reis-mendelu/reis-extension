import { describe, it, expect, afterEach, vi } from 'vitest';
import { devForcedPosition, devForcedNow } from '../devPosition';

const setSearch = (search: string) => {
  vi.stubGlobal('window', { location: { search } } as unknown as Window);
};
afterEach(() => vi.unstubAllGlobals());

describe('devForcedPosition', () => {
  it('reads lat,lon from the query string and returns [lon, lat]', () => {
    // FRRMS, typed the way a human copies it out of Google Maps.
    setSearch('?at=49.218161,16.614118');
    expect(devForcedPosition()).toEqual([16.614118, 49.218161]);
  });

  it('tolerates whitespace around the comma', () => {
    setSearch('?at=49.218161, 16.614118');
    expect(devForcedPosition()).toEqual([16.614118, 49.218161]);
  });

  it('coexists with the other dev flags', () => {
    setSearch('?native=ios&at=49.216233,16.630584');
    expect(devForcedPosition()).toEqual([16.630584, 49.216233]);
  });

  it('is null when the parameter is absent', () => {
    setSearch('?native=ios');
    expect(devForcedPosition()).toBeNull();
  });

  it('is null for a malformed value rather than feeding NaN to the router', () => {
    setSearch('?at=banana');
    expect(devForcedPosition()).toBeNull();
    setSearch('?at=49.21');
    expect(devForcedPosition()).toBeNull();
    setSearch('?at=49.21,16.6,3');
    expect(devForcedPosition()).toBeNull();
  });

  it('rejects a transposed pair, which is the mistake this format invites', () => {
    // 16.61 is not a latitude anywhere near Brno, and 49.21 is not a longitude.
    // Refusing beats silently routing from a point in the Indian Ocean and
    // spending an afternoon on why no route draws.
    setSearch('?at=16.614118,49.218161');
    expect(devForcedPosition()).toBeNull();
  });
});

describe('devForcedNow', () => {
  it('reads an ISO datetime from the query string', () => {
    setSearch('?now=2026-09-21T10:00:00');
    expect(devForcedNow()?.getHours()).toBe(10);
    expect(devForcedNow()?.getDay()).toBe(1); // Monday
  });

  it('is null when absent, so the real clock is used', () => {
    setSearch('?at=49.21,16.61');
    expect(devForcedNow()).toBeNull();
  });

  it('is null for a value that is not a date', () => {
    setSearch('?now=next%20tuesday');
    expect(devForcedNow()).toBeNull();
  });
});
