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

/** A Wednesday morning, garden open (po–pá 6:00–20:00). */
const WEEKDAY_MORNING = new Date('2026-09-23T10:00:00');
/** 23:14 on a Sunday — the clock the garden walk was first seen failing at. */
const SUNDAY_NIGHT = new Date('2026-09-27T23:14:00');

// The router AND the offer read the garden's hours, so every block in this file
// depends on the clock. Pinned here, at file level, or the file would pass by
// day and fail in a night-time CI run. Date only — the slice's own awaits still
// run on real timers. A test that needs the night sets it itself.
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(WEEKDAY_MORNING);
});
afterEach(() => vi.useRealTimers());

describe('createRouteSlice', () => {
  beforeEach(() => {
    currentPosition.mockReset();
    logLines = [];
    vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
      logLines.push(args.map(String).join(' '));
    });
    useAppStore.getState().clearRoute();
    // `clearRoute` keeps the offer now — the × puts the line away, it does
    // not forget the lecture — so a test that wants a clean slate says so.
    useAppStore.getState().suggestRoute(null);
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

  // Open hours: the garden is the short way from FRRMS, and the walk takes it.
  it('walks through the garden while it is open', async () => {
    currentPosition.mockResolvedValue(FRRMS);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('ready');
    expect(s.routeWalk!.gates).toContain('garden');
  });

  /**
   * And never once it is shut. For a while the hours were not consulted at
   * all, and at 23:14 on a Sunday this drew a walk through a garden nobody can
   * enter — a line on the map reads as an instruction. The gate is closed to
   * the router now; where there is no other way, there is no walk, and the
   * reason goes to the log with the other failures.
   */
  it('never walks through the garden once it is shut', async () => {
    vi.setSystemTime(SUNDAY_NIGHT);
    currentPosition.mockResolvedValue(FRRMS);
    await useAppStore.getState().routeTo('Q');
    const s = useAppStore.getState();
    expect(s.routeWalk?.gates ?? []).not.toContain('garden');
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

  it('KEEPS the offer when the walk is put away, so it can be asked again', async () => {
    // The × means "take this line off the map", not "forget the lecture".
    // Clearing both made it a one-way door: measured on the flow, after
    // dismissing there was no pill and no other route control anywhere, with
    // the room still selected — the only way back was the timetable.
    currentPosition.mockResolvedValue(MAIN_GATE);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q31' });
    await useAppStore.getState().routeTo('Q');
    useAppStore.getState().clearRoute();
    expect(useAppStore.getState().routeStatus).toBe('idle');
    expect(useAppStore.getState().routeWalk).toBeNull();
    expect(useAppStore.getState().routeSuggestion?.roomLabel).toBe('Q31');
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

  it('re-asks where the student is when the offer comes back', async () => {
    // `clearRoute` keeps the offer now, so the proximity answer it was given
    // must not outlive the walk: the student may have dismissed the line and
    // walked somewhere the next press could not start from.
    quiet.mockResolvedValue(PRAGUE);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q01' });
    expect(useAppStore.getState().canRouteFromHere).toBe(false);
    useAppStore.getState().clearRoute();
    expect(useAppStore.getState().canRouteFromHere).toBe(true);
  });

  it('lets the newer of two overlapping offers decide', async () => {
    // Two lesson pins tapped in quick succession. The first fix resolves LAST,
    // and a guard that only asks "is there a suggestion?" is satisfied by the
    // second one — so the first would answer a question nobody asked any more
    // and hide, or show, the wrong offer. Same generation guard `routeTo`
    // already carries, for the same reason.
    let releaseFirst: (v: [number, number] | null) => void = () => {};
    quiet.mockReturnValueOnce(
      new Promise((r) => {
        releaseFirst = r;
      })
    );
    const first = useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q01' });

    quiet.mockResolvedValue(FRRMS);
    await useAppStore.getState().suggestRoute({ buildingName: 'B', roomLabel: 'B11' });
    expect(useAppStore.getState().canRouteFromHere).toBe(true);

    // The abandoned request comes back from Prague. It must not be heard.
    releaseFirst(PRAGUE);
    await first;
    expect(useAppStore.getState().canRouteFromHere).toBe(true);
    expect(useAppStore.getState().routeSuggestion?.roomLabel).toBe('B11');
  });
});

describe('arriving from a second lesson', () => {
  beforeEach(() => {
    quiet.mockReset();
    currentPosition.mockReset();
    useAppStore.getState().clearRoute();
    useAppStore.getState().suggestRoute(null);
  });

  it('retires the walk drawn for the previous one', async () => {
    // Measured: walk to Q16, back to the timetable, tap Q02's pin — and Q16's
    // line was still on the map with no pill, because the offer is suppressed
    // while a walk exists. The only way to ask for Q02 was to press × first,
    // which is a dead end nobody would guess at.
    currentPosition.mockResolvedValue(MAIN_GATE);
    quiet.mockResolvedValue(null);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q16' });
    await useAppStore.getState().routeTo('Q');
    expect(useAppStore.getState().routeStatus).toBe('ready');

    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q02' });
    const s = useAppStore.getState();
    expect(s.routeStatus).toBe('idle');
    expect(s.routeWalk).toBeNull();
    expect(s.routeSuggestion?.roomLabel).toBe('Q02');
  });

  it('leaves a drawn walk alone when the offer is merely retired', async () => {
    // `suggestRoute(null)` is what leaving the map tab does. The student may
    // come back to the line they asked for, so that must not wipe it.
    currentPosition.mockResolvedValue(MAIN_GATE);
    quiet.mockResolvedValue(null);
    await useAppStore.getState().suggestRoute({ buildingName: 'Q', roomLabel: 'Q16' });
    await useAppStore.getState().routeTo('Q');
    await useAppStore.getState().suggestRoute(null);
    expect(useAppStore.getState().routeStatus).toBe('ready');
    expect(useAppStore.getState().routeWalk).not.toBeNull();
  });
});
