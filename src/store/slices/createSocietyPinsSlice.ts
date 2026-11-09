import type { AppSlice } from '../types';
import type { SocietyPin } from '../../types/campusMap';
import { fetchSocietyPins } from '../../api/mapEvents';
import { fetchVenuePins } from '../../api/venues';
import { SKLUB_PIN_ID } from '../../utils/menuTabs';

/** How old S-klub's scraped menu may get before a venue load refetches it. */
const SKLUB_MENU_GAP = 10 * 60 * 1000;

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
   * A pin opened from outside the map (the Jídelníček's S-klub tab): leaves
   * any floor plan, where pins are not drawn, and bumps `mapFocusRequest` —
   * the extension switches to its map view on that bump (useAppLogic) and the
   * canvas flies to the pin. The phone also brings its map tab forward.
   */
  showVenueOnMap: (pin: SocietyPin) => void;
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
    // S-klub's menu rides on the venue load (createSklubMenuSlice): only with
    // the café among the venues does anything ask sklubpixie.cz.
    if (get().venuePins.some((v) => v.id === SKLUB_PIN_ID)) {
      void get().refreshSklubMenu(SKLUB_MENU_GAP);
    }
  },
  selectSocietyPin: (pin) =>
    set({ mapSelection: { kind: 'societyPin', pin }, venueMenuSection: null }),
  showVenueOnMap: (pin) =>
    set({
      mapSelection: { kind: 'societyPin', pin },
      venueMenuSection: null,
      activeBuildingId: null,
      activeFloorId: null,
      mapFocusRequest: get().mapFocusRequest + 1,
      mapFocusTarget: 'campus',
      // Open before the canvas moves: MapRail would open it on the selection,
      // but only after the focus effect read the rail as closed and left the
      // pin under it (cubic on #660).
      mapRailOpen: true,
    }),
  setVenueMenuSection: (id) => set({ venueMenuSection: id }),
});
