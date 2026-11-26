import L from 'leaflet';
import { roomPlanLabels } from './roomPlanLabel';
import { venueRoomTitles } from './venueSearch';
import { parseSafeInset } from '../../utils/mobile/safeArea';
import type { RoomProperties, SocietyPin } from '../../types/campusMap';

/** Room the phone's search bar takes at the top of the map, below the status
 *  bar: its 1rem margin plus its own height, with a little air. */
const SEARCH_BAR_CLEARANCE_PX = 96;

/**
 * How far from the top edge the card may be panned to. The search bar sits
 * `1rem + --safe-top` down (MapScreen), so on a notched phone the clearance has
 * to grow by the inset or a tap near the top pans the card behind the bar. Read
 * at tap time: one computed-style read per tap, and the inset may have changed
 * since the map was built (rotation).
 */
export function popupTopClearancePx(): number {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--safe-top');
  return SEARCH_BAR_CLEARANCE_PX + parseSafeInset(raw);
}

/**
 * The compact card a tap on a floor-plan room opens on the phone tree: the
 * room's name and code, at the room, and nothing else.
 *
 * Why it exists. Only rooms drawn bigger than LABELLED_ROOM_SPAN_M carry a
 * permanent name, and every other room's name was a hover tooltip, which a
 * phone has no hover to show. The fix is deliberately NOT more permanent
 * labels: the span cut-off is there because a wall of overlapping codes is
 * unreadable. A tap is the one gesture every named room already answers.
 *
 * A Leaflet popup rather than a React card: it is anchored to the room under
 * the finger, it needs no layout room on the screen (the phone's sheet, the
 * tablet's rail and the floor column all already compete for it), and Leaflet
 * closes it on the next tap of the map itself. It takes Leaflet's own white
 * surface and dark text, which is right on a basemap that is always light, so
 * it needs no stylesheet of its own.
 *
 * The desktop tree does not use it: a room click there already opens
 * DetailPanel (name, type, seats, directions) at the bottom left, and the
 * pointer has hover. `src/test/guards/roomNameCardPerTree.test.ts` pins both
 * halves.
 */
export function openRoomNamePopup(
  map: L.Map,
  at: L.LatLng,
  p: RoomProperties,
  venuePins: readonly SocietyPin[]
): void {
  // A room IS gives no name has nothing to show. Read at tap time, so a venue
  // name that arrived after the plan was drawn is the one shown.
  const title = p.name ? roomPlanLabels(p, venueRoomTitles(venuePins)).full : '';
  if (!title) return;
  const text = document.createElement('div');
  // textContent, never innerHTML: the title is IS's text.
  text.textContent = title;
  text.className = 'text-[13px] font-semibold leading-snug';
  L.popup({
    className: 'room-name-popup',
    closeButton: false,
    maxWidth: 220,
    // The popup opens above the tap; a room near the top edge would otherwise
    // open it under the search bar.
    autoPanPaddingTopLeft: L.point(16, popupTopClearancePx()),
    autoPanPaddingBottomRight: L.point(16, 16),
  })
    .setLatLng(at)
    .setContent(text)
    .openOn(map);
}
