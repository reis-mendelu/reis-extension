import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const currentPosition = vi.fn();
// Partial mock: only the fix itself is faked. NO_PLATFORM stays the real
// constant, so the slice's "unavailable vs denied" branch is tested against
// the string the module actually throws rather than a copy that can drift.
const quiet = vi.fn();
vi.mock('../../../utils/routing/quietPosition', () => ({ quietPosition: () => quiet() }));
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
/** The FRRMS corridor, the far side of the arboretum — the one walk that used
 *  to depend on the garden's opening hours. */
const FRRMS: [number, number] = [16.614118, 49.218161];

/** Whatever the slice last wrote to the console, joined. Nothing reaches the
 *  screen any more, so this is the only place a reason can be checked. */
let logLines: string[] = [];
const logged = () => logLines.join(' | ');

describe('createRouteSlice', () => {
  beforeEach(() => {
    currentPosition.mockReset();
    logLines = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    });
    useAppStore.getState().clearRoute();
  });

  afterEach(() => vi.restoreAllMocks());

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

  it('never invents a start when the fix is nowhere near campus', async () => {
    currentPosition.mockResolvedValue(PRAGUE);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('failed');
    expect(s.routeWalk).toBeNull();
    expect(logged()).toMatch(/too far|snap/i);
  });

  it('fails silently when the fix cannot be had, and says why in the log', async () => {
    // One `failed` for every way this can go wrong, because nothing on screen
    // distinguishes them any more. The reason still has to be recoverable, so
    // it goes to the console — logcat on the device.
    currentPosition.mockRejectedValue(new Error('User denied Geolocation'));
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('failed');
    expect(logged()).toMatch(/RouteSlice/);
  });

  it('fails the same way on a platform with no geolocation at all', async () => {
    currentPosition.mockRejectedValue(new Error('geolocation: not a native platform'));
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('failed');
  });

  it('does not resurrect a route the student already cleared', async () => {
    // clearRoute stays available while the fix is in flight — the close button
    // is right there. Without a generation guard the pending request comes
    // back and sets `ready` over the idle state they asked for.
    let release: (v: [number, number]) => void = () => {};
    currentPosition.mockReturnValue(
      new Promise((r) => {
        release = r;
      })
    );
    const pending = useAppStore.getState().routeTo('Q');
    useAppStore.getState().clearRoute();
    release(MAIN_GATE);
    await pending;
    expect(useAppStore.getState().routeStatus).toBe('idle');
    expect(useAppStore.getState().routeWalk).toBeNull();
  });

  it('lets the newer of two overlapping requests win', async () => {
    let releaseFirst: (v: [number, number]) => void = () => {};
    currentPosition.mockReturnValueOnce(
      new Promise((r) => {
        releaseFirst = r;
      })
    );
    const first = useAppStore.getState().routeTo('A');
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().routeTo('Q');
    releaseFirst(MAIN_GATE);
    await first;
    expect(useAppStore.getState().routeTargetBuilding).toBe('Q');
  });

  it('fails for a building the graph does not name', async () => {
    // Budova Z — FRRMS. Not in the My MENDELU survey, so it has no nodes.
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().routeTo('Z');
    expect(useAppStore.getState().routeStatus).toBe('failed');
  });

  it('walks through the garden at midnight on a Sunday', async () => {
    // The gate hours are not consulted at all while the walk itself is being
    // perfected: a closed garden used to be the difference between a route and
    // a tram sentence, and the tram sentence is one of the messages that went.
    // FRRMS, 23:14 on a Sunday — the exact position and clock this failed at on
    // the device.
    currentPosition.mockResolvedValue(FRRMS);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('ready');
    expect(s.routeWalk!.gates).toContain('garden');
  });

  it('shows it is working while the fix is in flight', async () => {
    let release: (v: [number, number]) => void = () => {};
    currentPosition.mockReturnValue(
      new Promise((r) => {
        release = r;
      })
    );
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
    currentPosition.mockReturnValue(
      new Promise((r) => {
        release = r;
      })
    );
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

describe('routeSuggestion', () => {
  beforeEach(() => {
    currentPosition.mockReset();
    useAppStore.getState().clearRoute();
  });

  it('holds the lesson the student pointed at, without asking for a fix', () => {
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    const s = useAppStore.getState();
    expect(s.routeSuggestion).toEqual({ buildingName: 'Q', roomLabel: 'Q31' });
    // The pin tap must not prompt for location. That happens when the student
    // presses the button the suggestion offers, and not a moment earlier.
    expect(currentPosition).not.toHaveBeenCalled();
    expect(s.routeStatus).toBe('idle');
  });

  it('replaces the previous suggestion rather than stacking one behind it', () => {
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    useAppStore.getState().suggestRoute({ buildingName: 'B', roomLabel: 'B11' });
    expect(useAppStore.getState().routeSuggestion?.buildingName).toBe('B');
  });

  it('drops the suggestion once the route it offered is cleared', async () => {
    currentPosition.mockResolvedValue(MAIN_GATE);
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    await useAppStore.getState().routeTo('Q');
    useAppStore.getState().clearRoute();
    expect(useAppStore.getState().routeSuggestion).toBeNull();
  });

  it('drops the suggestion when the student picks somewhere else', () => {
    useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    useAppStore.getState().setRoutePickerOpen(true);
    // Opening the picker is the student saying "not that" — a stale suggestion
    // would otherwise re-offer Thursday's lecture over the library they chose.
    expect(useAppStore.getState().routeSuggestion).toBeNull();
  });
});

describe('the offer and where the student is standing', () => {
  beforeEach(() => {
    quiet.mockReset();
    useAppStore.getState().clearRoute();
  });

  it('starts out not knowing, which is not a no', () => {
    expect(useAppStore.getState().canRouteFromHere).toBe(true);
  });

  it('withdraws the offer when the fix cannot start a walk', async () => {
    quiet.mockResolvedValue(PRAGUE);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q01' });
    expect(useAppStore.getState().canRouteFromHere).toBe(false);
  });

  it('keeps it at FRRMS, the far side of the arboretum', async () => {
    quiet.mockResolvedValue(FRRMS);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q01' });
    expect(useAppStore.getState().canRouteFromHere).toBe(true);
  });

  it('keeps it when no fix can be had without asking', async () => {
    // The permission was never granted, so nothing was asked and nothing is
    // known. Hiding the offer on that would take the feature away from a
    // student standing on the campus.
    quiet.mockResolvedValue(null);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q01' });
    expect(useAppStore.getState().canRouteFromHere).toBe(true);
  });

  it('forgets what it knew once the offer is cleared', async () => {
    quiet.mockResolvedValue(PRAGUE);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q01' });
    useAppStore.getState().clearRoute();
    expect(useAppStore.getState().canRouteFromHere).toBe(true);
  });
});
