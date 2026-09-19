import L from 'leaflet';
import gardenPlacesJson from '../../data/map/gardenPlaces.json';
import type { GardenPlace } from '../../types/campusMap';
import type { Language } from '../../store/types';
import { POI_MARKER_STYLE } from './mapHelpers';

/** The botanical garden's id in remotePlaces.json — the only site with bubbles. */
export const GARDEN_PLACE_ID = -101;

export const GARDEN_PLACES = (gardenPlacesJson as { places: GardenPlace[] }).places;

/**
 * Below this zoom the places converge into a heap of overlapping circles, so
 * they are hidden — by a container class toggled on `zoomend`, the way
 * `reis-hide-building-labels` already works, rather than by rebuilding markers
 * the store-driven redraw knows nothing about.
 *
 * 16 is the zoom drilling into the garden itself lands on (it fits the garden
 * to the screen). It was 17, which hid every bubble at exactly the moment the
 * student asked to see the garden — verified in the running app, not reasoned
 * about. So this floor only bites when someone deliberately zooms back out.
 */
export const BUBBLE_HIDE_BELOW_ZOOM = 16;

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
export function drawGardenBubbles(
  layer: L.LayerGroup,
  opts: GardenBubbleOptions,
  /** The places to draw. Defaults to the shipped file; passed explicitly by the
   *  tests, which need places that do and do not carry a photograph. */
  places: GardenPlace[] = GARDEN_PLACES
): number {
  const size = opts.touch ? SIZE_TOUCH : SIZE_MOUSE;
  let drawn = 0;
  for (const place of places) {
    const tooltip: L.TooltipOptions = {
      direction: 'top',
      offset: [0, -size / 2],
      className: 'place-label',
    };
    // A place is a BUBBLE exactly when it has a photograph. Without one there is
    // nothing to put in the circle, and an empty ring on the map reads as a
    // picture that failed to load — so it stays a plain dot until its photo is
    // chosen, opening the same card either way.
    const marker = place.photo
      ? L.marker([place.lat, place.lon], {
          title: place.name[opts.lang],
          icon: L.divIcon({
            className: 'garden-bubble',
            // The circle is an INNER element on purpose. Leaflet writes
            // `transform: translate3d(...)` inline on the icon element itself to
            // position it, and an inline transform beats a stylesheet rule — so
            // a `:hover { transform: scale(2) }` on the icon is silently ignored
            // (verified in the browser: the bubble never grew). Scaling a child
            // Leaflet does not touch is what actually works.
            html: `<span class="garden-bubble-circle"><img src="/garden/${place.id}.webp" alt="" /></span>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2],
          }),
        })
      : L.circleMarker([place.lat, place.lon], POI_MARKER_STYLE);
    marker
      .on('click', () => opts.onSelect(place))
      .bindTooltip(place.name[opts.lang], tooltip)
      .addTo(layer);
    drawn++;
  }
  return drawn;
}
