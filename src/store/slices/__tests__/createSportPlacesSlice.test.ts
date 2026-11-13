import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import type { SportPlace } from '../../../types/campusMap';

const court: SportPlace = {
  id: 'basketbal-schreberovy-zahradky',
  sport: 'basketball',
  name: 'Basketbal Schreberovy zahrádky',
  coord: [16.62111, 49.20788],
  url: 'https://sportera.cz/place/basketbal/bfs-basketbal-schreberovy-zahradky',
  hours: 'nonstop',
  surface: 'tartan',
  count: 2,
  near: { building: 'E', metres: 370 },
};

describe('sport places on the map', () => {
  beforeEach(() =>
    useAppStore.setState({
      sportPlacesOn: false,
      mapSelection: null,
      activeBuildingId: null,
      activeFloorId: null,
      mapFocusRequest: 0,
      mapFocusTarget: 'campus',
    })
  );

  it('are off until the student turns Sport on', () => {
    expect(useAppStore.getState().sportPlacesOn).toBe(false);
  });

  it('turning Sport on shows them and points the camera at all of them', () => {
    useAppStore.getState().showSportPlaces();
    const s = useAppStore.getState();
    expect(s.sportPlacesOn).toBe(true);
    expect(s.mapFocusTarget).toBe('sport');
    expect(s.mapFocusRequest).toBe(1);
  });

  it('turning Sport on from a floor plan goes back to the campus, where the pins are', () => {
    useAppStore.setState({ activeBuildingId: 3, activeFloorId: 7 });
    useAppStore.getState().showSportPlaces();
    expect(useAppStore.getState().activeBuildingId).toBeNull();
    expect(useAppStore.getState().activeFloorId).toBeNull();
  });

  it('a tapped place becomes the map selection', () => {
    useAppStore.getState().showSportPlaces();
    useAppStore.getState().selectSportPlace(court);
    expect(useAppStore.getState().mapSelection).toEqual({ kind: 'sportPlace', place: court });
  });

  it('turning Sport off hides them and closes an open sport card', () => {
    useAppStore.getState().showSportPlaces();
    useAppStore.getState().selectSportPlace(court);
    useAppStore.getState().hideSportPlaces();
    expect(useAppStore.getState().sportPlacesOn).toBe(false);
    expect(useAppStore.getState().mapSelection).toBeNull();
  });

  it('turning Sport off leaves any other card open', () => {
    const other = { kind: 'placedRoom' as const, label: 'Q01', display: 'Q01' };
    useAppStore.getState().showSportPlaces();
    useAppStore.setState({ mapSelection: other });
    useAppStore.getState().hideSportPlaces();
    expect(useAppStore.getState().mapSelection).toEqual(other);
  });
});
