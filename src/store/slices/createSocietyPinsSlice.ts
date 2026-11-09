import type { AppSlice } from '../types';
import type { SocietyPin } from '../../types/campusMap';
import { fetchSocietyPins } from '../../api/mapEvents';
import { fetchVenuePins } from '../../api/venues';

/**
 * Society pins on the student map (`map_pins`): a society's logo between two
 * dates, opening its name, a short description and a link. Kept apart from
 * `mapEvents` on purpose — everything that lists events (Akce, the peek band,
 * Novinky) reads `mapEvents`, so a pin can never appear there.
 *
 * Venues (`venues`, S-klub's café) are permanent pins with hours, lunch and a
 * menu. Drawn by the same layer and opened through the same selection kind, so
 * every surface that shows a pin card shows a venue's too.
 *
 * Refreshed with the events (`reloadMapEvents`). A failed fetch keeps what is
 * on screen, as the events do; before the release creates a table the fetch
 * fails and the map simply has none of that kind.
 */
export interface SocietyPinsSlice {
  societyPins: SocietyPin[];
  venuePins: SocietyPin[];
  /**
   * The menu category open on a venue card. Null: on a phone, the category
   * grid; on a wide layout, the first category.
   */
  venueMenuSection: string | null;
  loadSocietyPins: () => Promise<void>;
  selectSocietyPin: (pin: SocietyPin) => void;
  /**
   * A pin chosen in the map search: what tapping it does, plus the way there.
   * Leaves any floor plan (pins are drawn on the campus only) and moves the
   * camera to it through `mapFocusRequest`, MapCanvas's one camera owner.
   */
  focusSocietyPin: (pin: SocietyPin) => void;
  setVenueMenuSection: (id: string | null) => void;
}

export const createSocietyPinsSlice: AppSlice<SocietyPinsSlice> = (set, get) => ({
  societyPins: [],
  venuePins: [],
  venueMenuSection: null,
  loadSocietyPins: async () => {
    const [pins, venues] = await Promise.all([fetchSocietyPins(), fetchVenuePins()]);
    if (pins !== null) set({ societyPins: pins });
    if (venues !== null) set({ venuePins: venues });
  },
  selectSocietyPin: (pin) =>
    set({ mapSelection: { kind: 'societyPin', pin }, venueMenuSection: null }),
  focusSocietyPin: (pin) =>
    set({
      activeBuildingId: null,
      activeFloorId: null,
      mapSelection: { kind: 'societyPin', pin },
      venueMenuSection: null,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus',
    }),
  setVenueMenuSection: (id) => set({ venueMenuSection: id }),
});
