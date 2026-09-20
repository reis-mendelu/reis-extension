import { describe, it, expect, beforeEach, vi } from 'vitest';

const currentPosition = vi.fn();
// Partial mock: only the fix itself is faked. NO_PLATFORM stays the real
// constant, so the slice's "unavailable vs denied" branch is tested against
// the string the module actually throws rather than a copy that can drift.
vi.mock('../../../utils/routing/position', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../utils/routing/position')>()),
  currentPosition: () => currentPosition(),
}));

import { useAppStore } from '../../useAppStore';

// The main gate, and a point between B and M. Both are real campus coordinates
// so the committed graph is what the slice is exercised against.
const MAIN_GATE: [number, number] = [16.617241, 49.210133];
const MID_CAMPUS: [number, number] = [16.6155, 49.2106];
const PRAGUE: [number, number] = [14.42, 50.08];

describe('createRouteSlice', () => {
  beforeEach(() => {
    currentPosition.mockReset();
    useAppStore.getState().clearRoute();
  });

  it('starts idle with nothing drawn', () => {
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('idle');
    expect(s.routeWalk).toBeNull();
    expect(s.routeTargetBuilding).toBeNull();
  });

  it('routes from a position on campus to a building', async () => {
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('ready');
    expect(s.routeTargetBuilding).toBe('Q');
    expect(s.routeWalk!.lengthM).toBeGreaterThan(0);
    expect(s.routeWalk!.coords.length).toBeGreaterThan(1);
    expect(s.routeFrom).toEqual(MAIN_GATE);
  });

  it('routes from the middle of the campus, which is the point of all this', async () => {
    currentPosition.mockResolvedValue(MID_CAMPUS);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('ready');
    expect(s.routeWalk!.lengthM).toBeLessThan(400);
  });

  it('reports too-far rather than inventing a start', async () => {
    currentPosition.mockResolvedValue(PRAGUE);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('too-far');
    expect(s.routeWalk).toBeNull();
  });

  it('reports denied when the student refused the permission', async () => {
    currentPosition.mockRejectedValue(new Error('User denied Geolocation'));
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('denied');
  });

  it('reports unavailable on a platform that has no geolocation at all', async () => {
    // A different answer from "you said no", and the student deserves to be
    // told which one it is.
    currentPosition.mockRejectedValue(new Error('geolocation: not a native platform'));
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('unavailable');
  });

  it('reports no-route for a building the graph does not name', async () => {
    // Budova Z — FRRMS. Not in the My MENDELU survey, so it has no nodes.
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().routeTo('Z');
    expect(useAppStore.getState().routeStatus).toBe('no-route');
  });

  it('shows it is working while the fix is in flight', async () => {
    let release: (v: [number, number]) => void = () => {};
    currentPosition.mockReturnValue(new Promise((r) => { release = r; }));
    const pending = useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('locating');
    release(MAIN_GATE);
    await pending;
    expect(useAppStore.getState().routeStatus).toBe('ready');
  });

  it('drops a stale walk the moment a new request starts', async () => {
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().routeTo('Q');
    let release: (v: [number, number]) => void = () => {};
    currentPosition.mockReturnValue(new Promise((r) => { release = r; }));
    const pending = useAppStore.getState().routeTo('A');
    // The old Q route must not still be on screen under an "A" heading.
    expect(useAppStore.getState().routeWalk).toBeNull();
    release(MAIN_GATE);
    await pending;
  });

  it('clears back to idle', async () => {
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().routeTo('Q');
    useAppStore.getState().clearRoute();
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('idle');
    expect(s.routeWalk).toBeNull();
    expect(s.routeTargetBuilding).toBeNull();
    expect(s.routeFrom).toBeNull();
  });
});
