import L from 'leaflet';
import gardenPlacesJson from '../../data/map/gardenPlaces.json';
import type { GardenPlace } from '../../types/campusMap';
import type { Language } from '../../store/types';
import { POI_MARKER_STYLE } from './mapHelpers';

/** The botanical garden's id in remotePlaces.json — the only site with bubbles. */
export const GARDEN_PLACE_ID = -101;

export const GARDEN_PLACES = (gardenPlacesJson as { places: GardenPlace[] }).places;

/**
 * The padding drilling into a remote place fits it with — MapCanvas.tsx:289.
 * The threshold below MUST use the same value, or it computes a zoom one level
 * deeper than the camera actually lands on and hides every bubble the instant
 * the garden opens. That is exactly what happened: verified in the browser,
 * twice, with two different wrong thresholds before this one.
 */
const FOCUS_PADDING = 50;

/**
 * Whether the bubbles should be hidden right now.
 *
 * NOT an absolute zoom floor. Drilling into the garden calls fitBounds, and the
 * zoom that produces depends on the viewport: 16 on a desktop pane, 15 on a
 * 375px phone. A fixed floor of 16 hid every bubble on the primary device.
 *
 * The real question is "is the garden drawn smaller than the view it opens at",
 * which getBoundsZoom answers for the current map size and padding.
 */
export function bubblesHidden(map: L.Map, gardenBounds: L.LatLngBounds): boolean {
  const fitZoom = map.getBoundsZoom(gardenBounds, false, L.point(FOCUS_PADDING, FOCUS_PADDING));
  return map.getZoom() < fitZoom;
}

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
    // A place is a BUBBLE exactly when it has a photograph, and draws NOTHING
    // without one. It used to fall back to a plain dot; a dot with no picture
    // behind it is a pin promising something the tap cannot deliver. The
    // coordinate still lives in gardenPlaces.json, so the day its photo arrives
    // it becomes a bubble by adding one field — nothing has to be surveyed
    // again.
    if (!place.photo) continue;
    const marker = L.marker([place.lat, place.lon], {
      title: place.name[opts.lang],
      icon: L.divIcon({
        className: 'garden-bubble',
        // The circle is an INNER element on purpose. Leaflet writes
        // `transform: translate3d(...)` inline on the icon element itself to
        // position it, and an inline transform beats a stylesheet rule — so a
        // `:hover { transform: scale(2) }` on the icon is silently ignored
        // (verified in the browser: the bubble never grew). Scaling a child
        // Leaflet does not touch is what actually works.
        html: `<span class="garden-bubble-circle"><img src="/garden/${place.id}.jpg" alt="" /></span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      }),
    });
    marker
      .on('click', () => opts.onSelect(place))
      .bindTooltip(place.name[opts.lang], tooltip)
      .addTo(layer);
    drawn++;
  }
  return drawn;
}
