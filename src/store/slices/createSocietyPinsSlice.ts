import type { AppSlice } from '../types';
import type { SocietyPin } from '../../types/campusMap';
import { fetchSocietyPins } from '../../api/mapEvents';

/**
 * Society pins on the student map (`map_pins`): a society's logo between two
 * dates, opening its name, a short description and a link. Kept apart from
 * `mapEvents` on purpose — everything that lists events (Akce, the peek band,
 * Novinky) reads `mapEvents`, so a pin can never appear there.
 *
 * Refreshed with the events (`reloadMapEvents`). A failed fetch keeps what is
 * on screen, as the events do; before the release creates the table the fetch
 * fails and the map simply has no pins.
 */
export interface SocietyPinsSlice {
  societyPins: SocietyPin[];
  loadSocietyPins: () => Promise<void>;
  selectSocietyPin: (pin: SocietyPin) => void;
}

export const createSocietyPinsSlice: AppSlice<SocietyPinsSlice> = (set) => ({
  societyPins: [],
  loadSocietyPins: async () => {
    const pins = await fetchSocietyPins();
    if (pins !== null) set({ societyPins: pins });
  },
  selectSocietyPin: (pin) => set({ mapSelection: { kind: 'societyPin', pin } }),
});
