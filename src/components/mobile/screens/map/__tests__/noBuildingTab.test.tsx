import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MapRail } from '../MapRail';
import { MapPanelBody } from '../MapPanelBody';
import { useAppStore } from '../../../../../store/useAppStore';

const BUILDING_ID = 54678; // A
const FLOOR_ID = 63279;

/**
 * "the map shouldn't show the 'budova Q' tab – completely useless, list of
 * rooms"
 *
 * It was the building's room register, and on Q's ground floor that is 88 rows
 * reading "Utility", "Toilet (M)", "Toilet (M)", "Toilet (W)", "Kitchen",
 * "Q1.05 Office" — untranslated, because the labels come from IS's estate data
 * rather than from anything written for students. Nobody navigates a campus by
 * scrolling past the toilets on floor 0.
 *
 * The two useful ways to find a room both survive this, which is why the tab
 * can go rather than be improved: the map draws the rooms as polygons you can
 * tap on the floor you are looking at, and the search bar finds a room by code
 * from anywhere ("Najdi místnost, budovu, akci…").
 *
 * With `budova` gone, `mapTab` had one legal value left — `knihovna` was
 * already dead, coerced to `akce` by both shells — so the tab state went with
 * it rather than being left as a field that can only hold one thing.
 */
describe('the map panel no longer browses a building room by room', () => {
  const roomsFor = (buildingId: number) => ({
    [buildingId]: {
      type: 'FeatureCollection' as const,
      features: [
        {
          type: 'Feature' as const,
          geometry: { type: 'Polygon' as const, coordinates: [[]] },
          properties: {
            id: 1,
            buildingId,
            floorId: FLOOR_ID,
            floorLevel: 1,
            name: 'BA01N1052',
            type: 'room',
            category: 'teaching',
            label: 'Posluchárna',
            passportNumber: null,
            nickname: null,
          },
        },
      ],
    },
  });

  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mapRailOpen: true,
      mapRailWidth: 340,
      mapSelection: null,
      mapEvents: [],
      activeBuildingId: BUILDING_ID,
      activeFloorId: FLOOR_ID,
      roomsByBuilding: roomsFor(BUILDING_ID),
    } as never);
  });

  it('offers no tabs at all while drilled into a building', () => {
    render(<MapRail />);

    expect(screen.queryByRole('tablist')).not.toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  // The room list is the thing being removed, not merely hidden behind a tab:
  // the data is loaded for the map's own polygons either way, so a stray render
  // path would put the register back on screen.
  it('never renders the room register, even with the rooms in the store', () => {
    render(<MapPanelBody selectedEvent={null} />);

    expect(screen.queryByText('Posluchárna')).not.toBeInTheDocument();
    expect(screen.queryByText('BA01N1052')).not.toBeInTheDocument();
  });

  // What is left has to be the events list, not a blank panel — the tab that
  // was removed was one of two, and the other one is the panel's whole job.
  it('shows the events list in the space the tabs used to take', () => {
    render(<MapRail />);

    expect(screen.getByText('Žádné akce')).toBeInTheDocument();
  });

  /**
   * The rail's title used to become the building's name whenever one was
   * selected, because a tab underneath it said which of the two things you were
   * looking at. With the room list gone the panel only ever holds events, so a
   * title reading "A" would name the building while listing the campus.
   */
  it('keeps calling itself Akce while a building is selected', () => {
    render(<MapRail />);

    expect(screen.getByText('Akce')).toBeInTheDocument();
    expect(screen.queryByText('A')).not.toBeInTheDocument();
  });

  // Floor switching is not part of this: it lives on the map itself
  // (`FloorSwitcher` over the canvas), which is where a floor plan belongs.
  it('leaves the floor selection untouched', () => {
    render(<MapRail />);

    expect(useAppStore.getState().activeFloorId).toBe(FLOOR_ID);
    expect(useAppStore.getState().activeBuildingId).toBe(BUILDING_ID);
  });
});
