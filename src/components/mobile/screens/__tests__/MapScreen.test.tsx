import { describe, it, expect, beforeEach, vi } from 'vitest';

// MapCanvas is a real Leaflet instance — happy-dom isn't a real browser and
// can't meaningfully exercise Leaflet's DOM/tile machinery (no layout, no
// tile network), and no other CampusMap test drives it directly either
// (there is no MapCanvas.test.tsx). Mocked to a stub so this test only
// asserts what MapScreen itself is responsible for: that MapCanvas mounts
// once and stays mounted, and that the sheet/tabs around it behave.
vi.mock('../../../CampusMap/MapCanvas', () => ({
  MapCanvas: () => <div data-testid="mock-map-canvas" />,
}));

// Mocked for the same reason as MapCanvas: it portals into a Leaflet pane that
// does not exist here, and it renders its own copy of each event's title, which
// collides with the sheet's copy in text queries.
vi.mock('../../../CampusMap/EventLayer', () => ({
  EventLayer: () => <div data-testid="mock-event-layer" />,
}));

// MapEventsSection (Akce tab body) pulls in useEventsFacultySettings, which
// does async IndexedDB + chrome.storage work via useEffect — mocked the same
// way MapSidePanel.test.tsx mocks it, so these tab-switch tests stay
// synchronous.
vi.mock('../../../../hooks/useEventsFacultySettings', () => ({
  useEventsFacultySettings: () => ({ subscribedFaculties: ['mendelu'], isLoading: false }),
}));

import { render, screen, fireEvent } from '@testing-library/react';
import { MapScreen } from '../MapScreen';
import { useAppStore } from '../../../../store/useAppStore';

// A real building id/floor id from src/data/map/buildings.json so FloorStack
// and BuildingRoomList have something real to key off.
const BUILDING_ID = 54678;
const FLOOR_ID = 67547;

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    mapSheetState: 'peek',
    activeBuildingId: null,
    activeFloorId: null,
    roomsByBuilding: {},
    mapEvents: [],
    societyMapEvents: [],
    eventFilter: 'all',
    mapSelection: null,
    adminConsoleOpen: false,
    adminRole: null,
  } as never);
});

// snapDetent is the real one everywhere except in the micro-flick test, which
// needs a detent change from a sub-slop drag without depending on how fast the
// machine delivered the events. See that test for why.
let forceDetentFlip = false;
vi.mock('../../primitives/sheetDrag', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../primitives/sheetDrag')>();
  return {
    ...actual,
    snapDetent: (from: 'peek' | 'expanded', dy: number, dt: number) =>
      forceDetentFlip
        ? from === 'expanded'
          ? 'peek'
          : 'expanded'
        : actual.snapDetent(from, dy, dt),
  };
});

describe('MapScreen', () => {
  const EVENT = {
    id: 'ev1',
    title: 'Deskovky',
    url: '',
    date: '2026-08-18',
    endDate: null,
    time: '18:30',
    location: 'Mystica',
    imageUrl: null,
    organizerKey: 'pef',
    societyId: 'supef',
    coord: [16.5952946, 49.2235078] as [number, number],
    roomCode: null,
    venueKind: 'offcampus' as const,
    category: 'boardgames' as const,
  };

  // Regression: the phone map listed society events in the Akce tab but never
  // drew them, because EventLayer was mounted only by the desktop CampusMapView
  // and the admin console. A society could publish an event and find no pin for
  // it on any student's phone.
  // Regression: a drag ends in a click on whatever was under the finger. The
  // handle and tabs guarded against that; the sheet's CONTENT did not — so
  // collapsing the sheet with a drag starting on the event card could cast an
  // RSVP or clear the selection as a side effect.
  it('swallows the click that ends a drag, so content actions do not fire', () => {
    useAppStore.setState({
      mapEvents: [EVENT],
      mapSheetState: 'expanded',
      mapSelection: { kind: 'event', event: EVENT },
    } as never);
    render(<MapScreen />);
    const sheet = screen.getByTestId('map-sheet');
    const back = screen.getByRole('button', { name: /Akce/ });

    // A drag the sheet absorbs: press on the sheet, move far enough that it
    // consumes the travel, release — then the click the browser still delivers.
    fireEvent.pointerDown(sheet, { clientY: 100 });
    fireEvent.pointerMove(sheet, { clientY: 260 });
    fireEvent.pointerUp(sheet, { clientY: 260 });
    fireEvent.click(back);

    // Still selected: the drag collapsed the sheet, it did not press Back.
    expect(useAppStore.getState().mapSelection).not.toBeNull();
  });

  // Regression: a cancelled drag left the suppression flag set, so the swallow
  // above would eat the student's NEXT legitimate tap instead of the click that
  // ended the drag. pointercancel is the browser taking the gesture, and it
  // produces no click — there is nothing to suppress.
  it('does not eat the next tap after the browser cancels a drag', () => {
    useAppStore.setState({
      mapEvents: [EVENT],
      mapSheetState: 'expanded',
      mapSelection: { kind: 'event', event: EVENT },
    } as never);
    render(<MapScreen />);
    const sheet = screen.getByTestId('map-sheet');

    fireEvent.pointerDown(sheet, { clientY: 100 });
    fireEvent.pointerMove(sheet, { clientY: 260 });
    fireEvent.pointerCancel(sheet);

    // The next tap is a real one and must go through.
    fireEvent.click(screen.getByRole('button', { name: /Akce/ }));
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  // Regression: consumesTravel is true for a single pixel, so a tap with the
  // normal jitter of a finger set the drag flag and the capture handler ate it.
  // Cards, RSVPs and tabs went intermittently unresponsive.
  it('treats a tap with slight finger drift as a tap, not a drag', () => {
    useAppStore.setState({
      mapEvents: [EVENT],
      mapSheetState: 'expanded',
      mapSelection: { kind: 'event', event: EVENT },
    } as never);
    render(<MapScreen />);
    const sheet = screen.getByTestId('map-sheet');

    // No pointerUp on purpose. It does not touch the suppression flag, but it
    // DOES run snapDetent, and 3px in the sub-millisecond gap between synthetic
    // events reads as a fast flick — the sheet would collapse and take the back
    // control off screen, testing the detent rule instead of the slop.
    fireEvent.pointerDown(sheet, { clientY: 100 });
    fireEvent.pointerMove(sheet, { clientY: 103 }); // 3px — under the slop
    fireEvent.click(screen.getByRole('button', { name: /Akce/ }));

    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  // Regression: a flick shorter than the slop but fast enough for snapDetent
  // moved the sheet while still counting as a tap, so the trailing click landed
  // on whatever was under the finger — clearing the event or casting an RSVP as
  // a side effect of collapsing.
  it('suppresses the click when a fast micro-flick changes the detent', () => {
    // Frozen clock, because the assertion is about velocity: `useMapSheetDrag`
    // reads `e.timeStamp`, which jsdom fills from the real one. On an idle
    // machine the gap between two synthetic events is sub-millisecond and the
    // flick is fast; under a loaded CI runner the same three pixels take
    // milliseconds and read as a slow drag, so the test failed on machine speed
    // rather than on behaviour.
    forceDetentFlip = true;
    useAppStore.setState({ mapEvents: [EVENT], mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const sheet = screen.getByTestId('map-sheet');

    // 3px, under DRAG_SLOP_PX, so the gesture is still a tap. Whether it is
    // ALSO fast enough to change the detent is snapDetent's decision, and it is
    // stubbed here (see the mock above) rather than produced by timing: jsdom
    // fills e.timeStamp from the real clock, so the same three pixels were a
    // fast flick on an idle laptop and a slow drag on a loaded CI runner. This
    // test is about what happens WHEN the detent changes under a tap; the
    // velocity rule that decides it is covered in sheetDrag.test.ts.
    fireEvent.pointerDown(sheet, { clientY: 100 });
    fireEvent.pointerMove(sheet, { clientY: 103 });
    fireEvent.pointerUp(sheet, { clientY: 103 });
    expect(useAppStore.getState().mapSheetState).toBe('peek');

    // The click the browser still delivers must not toggle it straight back.
    fireEvent.click(screen.getByRole('button', { name: /Akce na kampusu/ }));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
    forceDetentFlip = false;
  });

  it('mounts the event layer so society pins are drawn', () => {
    useAppStore.setState({ mapEvents: [EVENT] } as never);
    render(<MapScreen />);
    expect(screen.getByTestId('mock-event-layer')).toBeInTheDocument();
  });

  // Tapping a pin selects the event; desktop shows it in DetailPanel, which has
  // no room to float over a phone screen — the sheet has to take it, and has to
  // open itself, or the tap highlights a pin and appears to do nothing.
  it('opens a tapped event in the sheet and returns to the list', () => {
    useAppStore.setState({
      mapEvents: [EVENT],
      mapSelection: { kind: 'event', event: EVENT },
    } as never);
    render(<MapScreen />);

    // Out of peek — otherwise the peek row renders instead of the card — but
    // NOT pinned to a detent. A single event card is ~300px, and holding it in
    // a 70vh sheet left a quarter of the phone blank between the buttons and
    // the bottom, with the map it described hidden behind it. The height hugs
    // the content instead; the state only has to be somewhere that shows it.
    expect(useAppStore.getState().mapSheetState).not.toBe('peek');
    expect(screen.getByTestId('map-sheet').className).toContain('h-auto');
    // By role, not text: the boardgames category label is also "Deskovky",
    // so a bare text query matches the card's category row as well.
    expect(screen.getByRole('heading', { name: 'Deskovky' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Akce/ }));
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('mounts the map canvas', () => {
    render(<MapScreen />);
    expect(screen.getByTestId('mock-map-canvas')).toBeInTheDocument();
  });

  it('renders the sheet in peek state by default, with no tabs visible', () => {
    render(<MapScreen />);
    expect(screen.getByText('Akce na kampusu')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  /**
   * The sheet has exactly one thing to show, always: the campus events. A
   * segmented control around a single choice is chrome — a track and a white
   * selected pill framing the only option — so the row is a plain heading.
   */
  it('expands to a plain heading, not a one-tab segmented control', () => {
    render(<MapScreen />);
    fireEvent.click(screen.getByLabelText('Rozbalit panel mapy'));
    expect(useAppStore.getState().mapSheetState).toBe('half');
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Akce' })).toBeInTheDocument();
    expect(screen.getByText('Žádné akce')).toBeInTheDocument();
  });

  it('the map canvas stays mounted through the peek/expanded transition', () => {
    render(<MapScreen />);
    expect(screen.getByTestId('mock-map-canvas')).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Rozbalit panel mapy'));
    // Same mounted node, not a fresh one — proves MapCanvas wasn't torn down
    // and rebuilt when the sheet expanded.
    expect(screen.getByTestId('mock-map-canvas')).toBeInTheDocument();
  });

  it('typing in the search bar updates mapSearchQuery', () => {
    const setMapSearchQuery = vi.fn();
    useAppStore.setState({ setMapSearchQuery, mapSearchQuery: '', mapSearchResults: [] });
    render(<MapScreen />);
    fireEvent.change(screen.getByPlaceholderText('Najdi místnost, budovu, akci…'), {
      target: { value: 'Q01' },
    });
    expect(setMapSearchQuery).toHaveBeenCalledWith('Q01');
  });

  it('shows search results and focuses the room on click, then clears the query', () => {
    const focusRoomByCode = vi.fn();
    const setMapSearchQuery = vi.fn();
    useAppStore.setState({
      focusRoomByCode,
      setMapSearchQuery,
      mapSearchQuery: 'Q01',
      mapSearchResults: [
        {
          kind: 'roomRef',
          entry: { code: 'Q01', name: 'Q01', buildingId: 1, floorId: 1, floorLevel: 1, placeId: 1 },
        },
      ],
    } as never);
    render(<MapScreen />);
    fireEvent.click(screen.getByText('Q01'));
    expect(focusRoomByCode).toHaveBeenCalledWith('Q01');
    expect(setMapSearchQuery).toHaveBeenCalledWith('');
  });

  /**
   * There used to be a Budova tab here, listing the active building's room
   * register. Reported as "completely useless, list of rooms" — and it was
   * IS's estate data, untranslated: on Q's ground floor, 88 rows of "Toilet
   * (M)", "Utility", "Kitchen" and "Office". The rooms a student wants are
   * reachable the two ways that work — tapping a polygon on the floor plan, and
   * the search bar that finds a room by code from anywhere.
   *
   * The rooms stay in the store either way (the map's own polygons need them),
   * so this asserts against a populated store: nothing may put the register
   * back on screen.
   */
  it('shows no tab, and no room register, even with a building drilled into', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
      roomsByBuilding: {
        [BUILDING_ID]: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              geometry: { type: 'Polygon', coordinates: [[]] },
              properties: {
                id: 1,
                buildingId: BUILDING_ID,
                floorId: FLOOR_ID,
                floorLevel: 1,
                name: 'BA01N1052',
                type: 'room',
                category: 'teaching',
                label: 'Posluchárna',
                nickname: 'A01',
                passportNumber: 'BA01N1052',
                seats: 40,
                hasProjector: true,
                hasWhiteboard: false,
                code: 1052,
              },
            },
          ],
        },
      },
    });
    render(<MapScreen />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
    expect(screen.queryByText('A01')).not.toBeInTheDocument();
    expect(screen.queryByText('Posluchárna')).not.toBeInTheDocument();
  });
});

/**
 * targetSdk 36 forces edge-to-edge, so anything anchored to the top of a screen
 * renders UNDER the status bar (clock, 5G, notification icons) unless it carries
 * --safe-top. Every other screen gets that through ScreenHeader; the map floats
 * its own search bar instead and was missing it, so the search sat behind the
 * clock on a real handset.
 */
describe('MapScreen safe-area inset', () => {
  // Asserted on the CLASS, not an inline style: happy-dom's CSS parser rejects a
  // calc() containing a var() outright, leaving both el.style.marginTop and the
  // style attribute empty for a declaration real browsers apply fine. A Tailwind
  // arbitrary value survives as plain text and matches how the rest of this tree
  // expresses one-off values (h-[70vh], z-[1000]).
  const barClass = () =>
    screen.getByPlaceholderText('Najdi místnost, budovu, akci…').closest('div')?.className ?? '';

  /**
   * The map is the one tab with NO ScreenHeader — it is full-bleed, and a solid
   * title band above the canvas both costs a strip of map and reads as a lid on
   * it. That makes this floating bar the topmost element again, so it is the one
   * that has to carry the inset, or under targetSdk 36's forced edge-to-edge it
   * renders beneath the status bar's clock.
   */
  it('insets the floating search bar below the status bar', () => {
    render(<MapScreen />);
    expect(barClass()).toContain('var(--safe-top');
  });

  /**
   * A flat margin is exactly the bug: it looks right in a desktop browser, where
   * --safe-top resolves to 0, and fails only on the device.
   */
  it('keeps the base spacing on top of the inset', () => {
    render(<MapScreen />);
    expect(barClass()).toMatch(/calc\(.*rem/);
  });

  it('renders no screen header, unlike every other tab', () => {
    render(<MapScreen />);
    expect(screen.queryByLabelText('Rozbalit vývěsku')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Hledat')).not.toBeInTheDocument();
  });
});

/**
 * One stop per gesture. The sheet has three now — peek / half / expanded — so a
 * drag or a tap moves to the NEIGHBOURING stop rather than the far end; `half`
 * is what makes the campus events visible without covering the map. The pure
 * rules and their own cases live in primitives/__tests__/sheetDrag.test.ts.
 */
describe('MapSheet drag', () => {
  // The distance-vs-velocity rules live in sheetDrag.test.ts, not here: jsdom
  // stamps its own event timeStamps and ignores the ones fireEvent is given, so
  // every drag reads as an instant flick and a "slow drag" cannot be expressed.
  // Same reason Sheet.test.tsx leaves those cases to the pure tests.
  const drag = (from: number, to: number) => {
    const handle = screen.getByLabelText(/panel mapy/);
    fireEvent.pointerDown(handle, { clientY: from });
    fireEvent.pointerMove(handle, { clientY: to });
    fireEvent.pointerUp(handle, { clientY: to });
  };

  it('expands when the handle is dragged up', () => {
    render(<MapScreen />);
    drag(600, 400);
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  it('collapses when the handle is dragged down', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    drag(300, 500);
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  /**
   * Peek is the floor: this sheet is the only route to Akce, so dragging down
   * from it must not collapse it away.
   */
  it('stays at peek when dragged further down', () => {
    render(<MapScreen />);
    drag(400, 600);
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  /**
   * A drag ends in a click as well. Without suppression that click runs the tap
   * toggle and puts the sheet straight back where the drag just took it from —
   * the gesture would look like it did nothing, which is the original bug.
   */
  it('does not let the drag-ending click undo the snap', () => {
    render(<MapScreen />);
    const handle = screen.getByLabelText(/panel mapy/);
    fireEvent.pointerDown(handle, { clientY: 600, timeStamp: 0 });
    fireEvent.pointerMove(handle, { clientY: 400, timeStamp: 100 });
    fireEvent.pointerUp(handle, { clientY: 400, timeStamp: 100 });
    fireEvent.click(handle);
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  /**
   * The handle is a 4px pill at the very top of a 70vh sheet. Reaching it to
   * collapse means stretching to the top of the screen, so the tab row below it
   * drags too — the nearest thing to the content you are already looking at.
   */
  it('drags from the heading row, not just the handle', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const row = screen.getByRole('button', { name: 'Akce' });
    fireEvent.pointerDown(row, { clientY: 300 });
    fireEvent.pointerMove(row, { clientY: 500 });
    fireEvent.pointerUp(row, { clientY: 500 });
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  it('does not re-toggle when a drag starts on the heading row', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const row = screen.getByRole('button', { name: 'Akce' });
    fireEvent.pointerDown(row, { clientY: 300 });
    fireEvent.pointerMove(row, { clientY: 500 });
    fireEvent.pointerUp(row, { clientY: 500 });
    fireEvent.click(row);
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  it('collapses on a plain tap of the heading row', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Akce' }));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('collapses when dragged down from the content area', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const body = screen.getByText('Žádné akce');
    fireEvent.pointerDown(body, { clientY: 300 });
    fireEvent.pointerMove(body, { clientY: 500 });
    fireEvent.pointerUp(body, { clientY: 500 });
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });

  /**
   * The mirror image: while expanded, an UPWARD drag in the content is the
   * student scrolling the list. The sheet is already at its ceiling, so
   * absorbing it would freeze the list in place.
   */
  it('leaves an upward drag in the content to the list', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const body = screen.getByText('Žádné akce');
    fireEvent.pointerDown(body, { clientY: 500 });
    fireEvent.pointerMove(body, { clientY: 300 });
    fireEvent.pointerUp(body, { clientY: 300 });
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });

  /**
   * jsdom has no touch-action, so only the class can be asserted here. It is
   * load-bearing rather than cosmetic: without it the browser claims the drag as
   * a pan and fires pointercancel partway through — measured at ~20px of a 350px
   * swipe when the other sheets hit this.
   */
  it('marks the heading row as a drag surface for the browser', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    expect(screen.getByRole('button', { name: 'Akce' }).className).toContain('touch-none');
  });

  it('still toggles on a plain tap, with no drag in between', () => {
    render(<MapScreen />);
    const handle = screen.getByLabelText(/panel mapy/);
    fireEvent.pointerDown(handle, { clientY: 600, timeStamp: 0 });
    fireEvent.pointerUp(handle, { clientY: 600, timeStamp: 40 });
    fireEvent.click(handle);
    expect(useAppStore.getState().mapSheetState).toBe('half');
  });
});
