import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import remotePlacesJson from '../../data/map/remotePlaces.json';
import {
  ringToLatLng,
  remotePlaceRings,
  remotePlaceCenter,
  BUILDING_STYLE,
  GARDEN_STYLE,
  PATH_STYLE,
  POI_MARKER_STYLE,
} from './mapHelpers';
import { drawGardenBubbles, GARDEN_PLACE_ID } from './gardenBubbleLayer';
import type { RemotePlace } from '../../types/campusMap';

export const REMOTE = (remotePlacesJson as { places: RemotePlace[] }).places;
export const REMOTE_IDS = new Set(REMOTE.map((p) => p.id));

/**
 * The sites you cross rather than arrive at.
 *
 * The arboretum is one: a walk from Černá Pole to the campus goes straight
 * through it, and nobody needs telling it is a few minutes away. So it answers
 * no taps — they fall through to the map's own tap-away.
 *
 * A list of ids, deliberately, rather than a rule read off the geometry. The
 * first cut used `!!place.area`, which is true of Panská lícha as well — its
 * `area` is the surrounding grounds, but the riding hall inside it is exactly
 * the sort of place a student is told to turn up at, and it quietly stopped
 * being clickable. Which places are scenery is an editorial judgement; it is
 * not derivable from whether OSM happens to draw a boundary.
 */
const WALK_THROUGH_IDS = new Set([-101]); // Botanická zahrada a arboretum
export const walksThrough = (place: Pick<RemotePlace, 'id'>) => WALK_THROUGH_IDS.has(place.id);

// The off-campus MENDELU sites drawn as their real OSM footprints, in the same
// blue campus-building theme as landmarks.
//
// Every site draws its whole inner map — footpaths, buildings, labelled
// collections — whatever is selected. It used to take a click to reveal any of
// that for the arboretum, which meant the garden's footpaths, the one genuinely
// useful thing about it, were visible only to someone who already knew to look.
// There is no "drilled in" state left: with every site drawing its whole inner
// map, selecting one changed nothing on screen. On a far site, any part of it
// still selects the whole site.
export function drawRemotePlaces(
  layer: L.LayerGroup,
  select: ReturnType<typeof useAppStore.getState>
) {
  for (const p of REMOTE) {
    const [clon, clat] = remotePlaceCenter(p);
    const select_ = () =>
      select.selectMapPoi(
        { id: p.id, name: p.name, type: p.address ?? '', url: p.url, phone: null, email: null },
        [clon, clat]
      );
    // The garden answers no question, so it takes no taps.
    //
    // It is scenery you walk through, not somewhere you navigate to — and a
    // big green shape that swallowed a tap and flew the camera off to Černá
    // Pole was answering a question nobody had asked, right next to seven
    // buildings where a tap means something. Its taps now fall through to the
    // map, which is the campus's own "tap away to dismiss".
    //
    // HOVER is untouched: the shapes stay interactive, they simply have no
    // click handler, so the names still appear on a point or a tap. Every other
    // site keeps its click — for the far ones (Lednice/Žabčice/Křtiny) an
    // outline on the edge of the map is their only handle.
    //
    // Named, NOT inferred from `area`. Panská lícha has an `area` too — its
    // grounds — but it is somewhere students are sent, and deriving this from
    // geometry silently took the click off its riding hall as well.
    const inert = walksThrough(p);
    const passThrough = (style: L.PathOptions) =>
      inert ? { ...style, bubblingMouseEvents: true } : style;
    const onClick = <T extends L.Layer>(l: T, fn: () => void) => (inert ? l : l.on('click', fn));

    // `coordinates[0]` is an indexed read, so it is only a ring by convention —
    // a Polygon with an empty coordinate list types the same and would draw an
    // empty shape here rather than failing where the data is wrong.
    const grounds = p.area?.coordinates[0];
    if (grounds?.length) {
      // Through `onClick` like every other shape. Taking the handler off this
      // one outright was the same mistake in a second place: Panská lícha's
      // grounds are the biggest target it has, and they stopped opening it.
      onClick(L.polygon(ringToLatLng(grounds), passThrough(GARDEN_STYLE)), select_)
        .bindTooltip(p.shortName)
        .addTo(layer);
    }
    // Drawn ALWAYS, not only once the garden has been clicked.
    //
    // The arboretum is not a place anyone navigates TO — nobody needs telling
    // it is a two-minute walk. It is a place people walk THROUGH, on the way
    // between the campus and Černá Pole, and the only thing the map owes them
    // is the sight of a path going through it. Behind a click, that path was
    // information only someone who already knew about it would ever find.
    if (p.paths)
      for (const path of p.paths) {
        L.polyline(ringToLatLng(path), PATH_STYLE).addTo(layer);
      }
    for (const ring of remotePlaceRings(p.outline)) {
      onClick(L.polygon(ringToLatLng(ring), passThrough(BUILDING_STYLE)), select_)
        .bindTooltip(p.shortName)
        .addTo(layer);
    }
    if (p.pois)
      for (const poi of p.pois) {
        onClick(L.circleMarker([poi.lat, poi.lon], passThrough(POI_MARKER_STYLE)), select_)
          // Not `permanent`: two names pinned over the greenhouses sat on the
          // map whether or not anyone had asked what those buildings were.
          // Leaflet opens a plain tooltip on hover, and on a touch device on
          // tap, so the name is still reachable on a phone. The default
          // tooltip box is deliberate too — `room-label` is transparent, which
          // reads only because a permanent label sits still.
          .bindTooltip(poi.name, { direction: 'right' })
          .addTo(layer);
      }

    // The garden's photo bubbles.
    //
    // Drawn ALWAYS, like the footpaths above and for the same reason: behind a
    // click they were findable only by someone who already knew. The garden
    // itself stays inert — it is scenery you walk through — but a bubble is not
    // the big green shape, it is a 28px photograph of one specific spot, and
    // tapping THAT is a question worth answering.
    //
    // What keeps them off the campus overview is no longer a drilled-in state
    // but zoom: see `bubblesHidden`, toggled as a container class on zoomend.
    if (p.id === GARDEN_PLACE_ID) {
      drawGardenBubbles(layer, {
        touch: typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches,
        onSelect: select.selectGardenPlace,
      });
    }
  }
}
