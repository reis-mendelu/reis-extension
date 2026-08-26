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

import { render, screen, fireEvent, createEvent } from '@testing-library/react';
import { MapScreen } from '../MapScreen';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Dispatch a pointer event with a REAL, controlled `timeStamp`.
 *
 * `fireEvent.pointerUp(el, { timeStamp })` silently ignores it -- timeStamp is
 * readonly on Event, so the handler still sees performance.now(). snapDetent
 * derives velocity as dy/dt from exactly that field, so any test asserting a
 * flick was riding on how fast the machine happened to dispatch two synthetic
 * events. Defining the property on a created event is what actually pins it.
 *
 * `t` must be NON-ZERO. React builds its synthetic event with
 * `timeStamp: nativeEvent.timeStamp || Date.now()`, and 0 is falsy -- a t of 0
 * silently becomes a wall-clock epoch, so a pointerDown at 0 and a pointerUp at 1
 * produce a dt of about -1.8e12 and every velocity rule quietly inverts.
 */
function pointer(
  el: Element,
  type: 'pointerDown' | 'pointerMove' | 'pointerUp',
  init: { clientY: number; t: number }
) {
  const ev = createEvent[type](el, { clientY: init.clientY });
  // clientY has to be defined explicitly too: happy-dom's PointerEvent drops it
  // from the init dict, and an undefined clientY makes dy NaN -- which loses
  // every comparison in snapDetent and silently returns the current detent, so
  // the test reads as "the sheet did not move" no matter what it was given.
  Object.defineProperty(ev, 'clientY', { value: init.clientY, configurable: true });
  Object.defineProperty(ev, 'timeStamp', { value: init.t, configurable: true });
  fireEvent(el, ev);
}

// A real building id/floor id from src/data/map/buildings.json so FloorStack
// and BuildingRoomList have something real to key off.
const BUILDING_ID = 54678;
const FLOOR_ID = 67547;

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    mapSheetState: 'peek',
    mapTab: 'akce',
    activeBuildingId: null,
    activeFloorId: null,
    roomsByBuilding: {},
    mapEvents: [],
    societyMapEvents: [],
    eventFilter: 'all',
    mapSelection: null,
    adminConsoleOpen: false,
    adminRole: null,
    libraryAvailability: {},
    libraryAvailabilityLoaded: true,
  } as never);
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
    useAppStore.setState({ mapEvents: [EVENT], mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const sheet = screen.getByTestId('map-sheet');

    // 3px is under DRAG_SLOP_PX, but it clears snapDetent's velocity threshold.
    // The timeStamps must be explicit: snapDetent takes dt from `e.timeStamp`,
    // so without them this rides on real elapsed time between synthetic events
    // and flips under load. 3px over 1ms clears DISMISS_VELOCITY_PX_PER_MS
    // deterministically, on any machine.
    pointer(sheet, 'pointerDown', { clientY: 100, t: 1000 });
    pointer(sheet, 'pointerMove', { clientY: 103, t: 1001 });
    pointer(sheet, 'pointerUp', { clientY: 103, t: 1001 });
    expect(useAppStore.getState().mapSheetState).toBe('peek');

    // The click the browser still delivers must not toggle it straight back.
    fireEvent.click(screen.getByRole('button', { name: /Akce na kampusu/ }));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
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

    expect(useAppStore.getState().mapSheetState).toBe('expanded');
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
   * Knihovna is hidden on mobile and Budova needs a selected building, so the
   * default expanded sheet has exactly one thing to show. A segmented control
   * around a single choice is chrome — a track and a white selected pill
   * framing the only option — so the row renders as a plain heading instead.
   */
  it('expands to a plain heading, not a one-tab segmented control', () => {
    render(<MapScreen />);
    fireEvent.click(screen.getByLabelText('Rozbalit panel mapy'));
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
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

  /**
   * mapTab persists, so a student who last used Knihovna on desktop would come
   * back to a tab this sheet no longer renders — and, before the fallback, to an
   * empty body with no tab to click. Akce is what they get instead.
   */
  it('falls back to Akce when a persisted Knihovna tab is no longer offered', () => {
    useAppStore.setState({ mapSheetState: 'expanded', mapTab: 'knihovna' });
    render(<MapScreen />);
    expect(screen.queryByText('Studovny knihovny')).not.toBeInTheDocument();
    // The Akce BODY, not the heading: the heading renders whatever `mapTab`
    // says, so only the body proves the fallback actually resolved.
    expect(screen.getByText('Žádné akce')).toBeInTheDocument();
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

  it('does not show a Budova tab when no building is selected', () => {
    useAppStore.setState({ mapSheetState: 'expanded' });
    render(<MapScreen />);
    expect(screen.queryByRole('tab', { name: /Budova/ })).not.toBeInTheDocument();
  });

  it('shows the Budova tab only once a building is selected', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
      roomsByBuilding: { [BUILDING_ID]: { type: 'FeatureCollection', features: [] } },
    });
    render(<MapScreen />);
    expect(screen.getByRole('tab', { name: 'Budova A' })).toBeInTheDocument();
  });

  it('clicking Budova switches to the room list for the active building/floor', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      mapTab: 'budova',
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
    expect(screen.getByText('A01')).toBeInTheDocument();
    expect(screen.getByText('Posluchárna')).toBeInTheDocument();
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
});

/**
 * The handle was drawn as a drag pill but wired to nothing but onClick, so the
 * sheet could only be tapped open — swiping it did nothing at all, which reads
 * as a frozen app rather than an unimplemented gesture.
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
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });

  it('collapses when the handle is dragged down', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    drag(300, 500);
    expect(useAppStore.getState().mapSheetState).toBe('peek');
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
    pointer(handle, 'pointerDown', { clientY: 600, t: 1000 });
    pointer(handle, 'pointerMove', { clientY: 400, t: 1100 });
    pointer(handle, 'pointerUp', { clientY: 400, t: 1100 });
    fireEvent.click(handle);
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
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
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('drags from the tab row too, once a building makes it a real tablist', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
    } as never);
    render(<MapScreen />);
    const tabRow = screen.getByRole('tablist');
    fireEvent.pointerDown(tabRow, { clientY: 300 });
    fireEvent.pointerMove(tabRow, { clientY: 500 });
    fireEvent.pointerUp(tabRow, { clientY: 500 });
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  /**
   * The heading is a button, so a drag that ends on it fires a click — and that
   * click collapses the sheet straight back out of the detent the drag chose.
   */
  it('does not re-toggle when a drag starts on the heading row', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const row = screen.getByRole('button', { name: 'Akce' });
    fireEvent.pointerDown(row, { clientY: 300 });
    fireEvent.pointerMove(row, { clientY: 500 });
    fireEvent.pointerUp(row, { clientY: 500 });
    fireEvent.click(row);
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  it('collapses on a plain tap of the heading row', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    fireEvent.click(screen.getByRole('button', { name: 'Akce' }));
    expect(useAppStore.getState().mapSheetState).toBe('peek');
  });

  /**
   * The tabs are buttons, so a drag that starts on one ends in a click on it.
   * Without suppression that click switches tab as a side effect of collapsing.
   */
  /**
   * Needs TWO tabs and a starting tab that is not the one being dragged from,
   * otherwise the assertion passes whether or not the click is suppressed.
   */
  it('does not switch tab when a drag starts on a tab button', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      mapTab: 'budova',
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
    } as never);
    render(<MapScreen />);
    const akce = screen.getByRole('tab', { name: 'Akce' });
    fireEvent.pointerDown(akce, { clientY: 300 });
    fireEvent.pointerMove(akce, { clientY: 500 });
    fireEvent.pointerUp(akce, { clientY: 500 });
    fireEvent.click(akce);
    expect(useAppStore.getState().mapSheetState).toBe('peek');
    expect(useAppStore.getState().mapTab).toBe('budova');
  });

  it('still switches tab on a plain tap', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      mapTab: 'budova',
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
    } as never);
    render(<MapScreen />);
    const akce = screen.getByRole('tab', { name: 'Akce' });
    fireEvent.pointerDown(akce, { clientY: 300 });
    fireEvent.pointerUp(akce, { clientY: 300 });
    fireEvent.click(akce);
    // A tap selects the tab and must not collapse the sheet.
    expect(useAppStore.getState().mapTab).toBe('akce');
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });

  /**
   * Dragging a sheet down anywhere on it is what every native sheet does — the
   * handle is an affordance, not the only grab point.
   */
  it('collapses when dragged down from the content area', () => {
    useAppStore.setState({ mapSheetState: 'expanded' } as never);
    render(<MapScreen />);
    const body = screen.getByText('Žádné akce');
    fireEvent.pointerDown(body, { clientY: 300 });
    fireEvent.pointerMove(body, { clientY: 500 });
    fireEvent.pointerUp(body, { clientY: 500 });
    expect(useAppStore.getState().mapSheetState).toBe('peek');
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

  it('marks the tab row as a drag surface for the browser', () => {
    useAppStore.setState({
      mapSheetState: 'expanded',
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
    } as never);
    render(<MapScreen />);
    expect(screen.getByRole('tablist').className).toContain('touch-none');
  });

  it('still toggles on a plain tap, with no drag in between', () => {
    render(<MapScreen />);
    const handle = screen.getByLabelText(/panel mapy/);
    pointer(handle, 'pointerDown', { clientY: 600, t: 1000 });
    pointer(handle, 'pointerUp', { clientY: 600, t: 1040 });
    fireEvent.click(handle);
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
  });
});
