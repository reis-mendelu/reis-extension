import L from 'leaflet';
import gardenPlacesJson from '../../data/map/gardenPlaces.json';
import type { GardenPlace } from '../../types/campusMap';
import type { Language } from '../../store/types';

/** The botanical garden's id in remotePlaces.json — the only site with bubbles. */
export const GARDEN_PLACE_ID = -101;

export const GARDEN_PLACES = (gardenPlacesJson as { places: GardenPlace[] }).places;

/**
 * Below this zoom the places converge into a heap of overlapping circles, so
 * they are hidden — by a container class toggled on `zoomend`, the way
 * `reis-hide-building-labels` already works, rather than by rebuilding markers
 * the store-driven redraw knows nothing about.
 */
export const BUBBLE_HIDE_BELOW_ZOOM = 17;

/** Resting diameter. A mouse grows it on hover; a finger cannot, so a touch
 *  device rests at the 44px minimum target instead. */
const SIZE_MOUSE = 28;
const SIZE_TOUCH = 44;

export interface GardenBubbleOptions {
  lang: Language;
  /** True on a coarse pointer: no hover exists, so the middle state does not. */
  touch: boolean;
  onSelect: (place: GardenPlace) => void;
}

/**
 * A photograph pinned at each of the garden's places. Only drawn when the
 * garden is drilled into — see drawRemotePlaces — so the campus overview never
 * becomes a gallery.
 *
 * The thumb is bundled (`public/garden/<id>.webp`, 96x96, ~4 KB) rather than
 * fetched: this is the state you see almost all the time, and it has to paint
 * instantly, offline, standing in the garden on one bar of signal.
 */
export function drawGardenBubbles(layer: L.LayerGroup, opts: GardenBubbleOptions): number {
  const size = opts.touch ? SIZE_TOUCH : SIZE_MOUSE;
  let drawn = 0;
  for (const place of GARDEN_PLACES) {
    const icon = L.divIcon({
      className: 'garden-bubble',
      html: `<img src="/garden/${place.id}.webp" alt="" />`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    L.marker([place.lat, place.lon], { icon, title: place.name[opts.lang] })
      .on('click', () => opts.onSelect(place))
      .bindTooltip(place.name[opts.lang], {
        direction: 'top',
        offset: [0, -size / 2],
        className: 'place-label',
      })
      .addTo(layer);
    drawn++;
  }
  return drawn;
}
