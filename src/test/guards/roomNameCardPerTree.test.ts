import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tapping a room names it, on both trees, by two different means.
 *
 * Phone and iPad (the phone tree): a compact Leaflet card at the room
 * (roomNamePopup.ts), opened from drawFloorView's click handler. There is no
 * hover to show a small room's name and no DetailPanel on that tree, and the
 * answer is a card rather than more permanent labels, which is why the
 * LABELLED_ROOM_SPAN_M cut-off exists (Task List, November 2026).
 *
 * Desktop (the extension): the same click already opens DetailPanel at the
 * bottom left, and the pointer has hover tooltips, so the card is not drawn
 * there. A second box saying the same thing beside it would be noise.
 *
 * Behaviour of both halves is in drawFloorView.roomName.test.ts; this pins the
 * seam so a later "just always open the card" or "drop the desktop panel" is a
 * decision rather than an accident.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('room name on tap', () => {
  it('the card is opened only for the phone tree', () => {
    expect(read('components/CampusMap/drawFloorView.ts')).toMatch(
      /if \(isPhone\) openRoomNamePopup\(/
    );
  });

  it('the desktop tree names a tapped room in DetailPanel', () => {
    const view = read('components/CampusMap/CampusMapView.tsx');
    expect(view).toContain('<DetailPanel />');
    expect(view).not.toContain('openRoomNamePopup');
  });
});
