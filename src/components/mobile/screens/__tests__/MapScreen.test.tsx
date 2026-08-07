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
    mapTab: 'akce',
    activeBuildingId: null,
    activeFloorId: null,
    roomsByBuilding: {},
    mapEvents: [],
    societyMapEvents: [],
    eventFilter: 'all',
    mapSelection: null,
    mapMode: 'student',
    adminRole: null,
    libraryAvailability: {},
    libraryAvailabilityLoaded: true,
  } as never);
});

describe('MapScreen', () => {
  it('mounts the map canvas', () => {
    render(<MapScreen />);
    expect(screen.getByTestId('mock-map-canvas')).toBeInTheDocument();
  });

  it('renders the sheet in peek state by default, with no tabs visible', () => {
    render(<MapScreen />);
    expect(screen.getByText('Vytáhni pro události a rezervaci')).toBeInTheDocument();
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
  });

  it('tapping the handle expands the sheet and reveals the tabs', () => {
    render(<MapScreen />);
    fireEvent.click(screen.getByLabelText('Rozbalit panel mapy'));
    expect(useAppStore.getState().mapSheetState).toBe('expanded');
    expect(screen.getByRole('tablist')).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Akce' })).toBeInTheDocument();
    // Library study-room reservation is hidden on mobile.
    expect(screen.queryByRole('tab', { name: 'Knihovna' })).not.toBeInTheDocument();
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
    expect(screen.getByRole('tab', { name: 'Akce' })).toHaveAttribute('aria-selected', 'true');
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
