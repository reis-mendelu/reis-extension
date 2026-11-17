import type { AppSlice } from '../types';
import type { SportPlace } from '../../types/campusMap';

/**
 * The Sportera places on the campus map (`src/data/map/sportPlaces.json`).
 * Always drawn on the overview — there is no switch in front of them (decided
 * 2026-11-15) — so the only state is which one is open.
 */
export interface SportPlacesSlice {
  selectSportPlace: (place: SportPlace) => void;
}

export const createSportPlacesSlice: AppSlice<SportPlacesSlice> = (set) => ({
  selectSportPlace: (place) => set({ mapSelection: { kind: 'sportPlace', place } }),
});
