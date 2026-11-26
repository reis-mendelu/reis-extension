import L from 'leaflet';
import { roomPlanLabels } from './roomPlanLabel';
import { venueRoomTitles } from './venueSearch';
import type { RoomProperties, SocietyPin } from '../../types/campusMap';

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
    // open it under the search bar (about 90px tall with its margin).
    autoPanPaddingTopLeft: L.point(16, 96),
    autoPanPaddingBottomRight: L.point(16, 16),
  })
    .setLatLng(at)
    .setContent(text)
    .openOn(map);
}
