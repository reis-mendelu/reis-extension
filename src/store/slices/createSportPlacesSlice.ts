import type { AppSlice } from '../types';
import type { SportPlace } from '../../types/campusMap';

/**
 * The Sportera places on the campus map (`src/data/map/sportPlaces.json`). Off
 * until the student taps "Sport": seven pins outside the campus frame are
 * noise to everyone who opened the map to find a room. Not remembered across
 * launches — the map opens on the campus, as always.
 */
export interface SportPlacesSlice {
  sportPlacesOn: boolean;
  /**
   * Shows the pins and fits the camera to all of them (`mapFocusTarget:
   * 'sport'`, read by MapCanvas, the one camera owner). Leaves a floor plan,
   * because the pins are drawn on the campus only.
   */
  showSportPlaces: () => void;
  /** Hides the pins, and closes the card of one if it is open. */
  hideSportPlaces: () => void;
  selectSportPlace: (place: SportPlace) => void;
}

export const createSportPlacesSlice: AppSlice<SportPlacesSlice> = (set, get) => ({
  sportPlacesOn: false,
  showSportPlaces: () =>
    set({
      sportPlacesOn: true,
      activeBuildingId: null,
      activeFloorId: null,
      // MapCanvas answers an open card's selection before the 'sport' target,
      // so with one open the chip flew to that card instead. As the other
      // focus actions in createMapSlice do, the move replaces the selection.
      mapSelection: null,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'sport',
    }),
  hideSportPlaces: () =>
    set({
      sportPlacesOn: false,
      // Left at 'sport', any later redraw of the overview re-fitted the hidden
      // places; 'campus' is where the map rests.
      mapFocusTarget: 'campus',
      ...(get().mapSelection?.kind === 'sportPlace' ? { mapSelection: null } : {}),
    }),
  selectSportPlace: (place) => set({ mapSelection: { kind: 'sportPlace', place } }),
});
