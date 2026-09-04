import { venueMapChoices, type MapPlatform, type PreferredMapApp } from './venueMapUrl';

export interface MapAppOption {
  id: 'apple' | 'google' | 'ask';
  /** i18n key for the option's label. */
  labelKey: string;
  selected: boolean;
}

/**
 * The options the Profil "Mapy" row offers, and which one is on.
 *
 * Derived from `venueMapChoices` rather than listing the platforms again: the
 * row exists exactly when a venue tap has something to ask about. Android's
 * `geo:` is itself the chooser and a browser has one URL, so on both of those
 * there is a single choice and therefore nothing to remember — an empty list,
 * and no row.
 *
 * `null` is a value here, not a gap. "Vždy se zeptat" is one of the three
 * things a student can pick, which is what stops the row from being a control
 * that removes itself: the row used to render only while a preference was
 * stored, and clearing it — which was what a tap anywhere on the row did —
 * unmounted the row along with the only way back to being asked.
 *
 * An unrecognised stored value lights "ask", matching `resolveVenueChoice`,
 * which also treats it as "ask" rather than resolving to nothing. The row must
 * not claim a choice the tap will ignore.
 */
export function mapAppOptions(platform: MapPlatform, preferred: PreferredMapApp): MapAppOption[] {
  if (venueMapChoices([0, 0], '', platform).length < 2) return [];
  const on: MapAppOption['id'] =
    preferred === 'apple' || preferred === 'google' ? preferred : 'ask';
  return [
    { id: 'apple', labelKey: 'map.openInAppleMaps', selected: on === 'apple' },
    { id: 'google', labelKey: 'map.openInGoogleMaps', selected: on === 'google' },
    { id: 'ask', labelKey: 'map.mapAppAsk', selected: on === 'ask' },
  ];
}
