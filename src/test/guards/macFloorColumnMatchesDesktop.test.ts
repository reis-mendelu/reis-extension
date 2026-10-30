import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The floor column moved on the PHONE tree only, and only on a Mac.
 *
 * The iPad app on a Mac runs the phone tree with a mouse, and its column stood
 * beside the tablet rail, in the middle of a ~1782px map. Without a touch
 * screen it now stands top-left under the search bar with btn-sm buttons
 * (src/components/mobile/screens/map/FloorSwitcher.tsx, via
 * `floorColumnPlacement` in src/utils/mapRail.ts).
 *
 * The desktop tree needs no change, and that is the decision pinned here: its
 * column has always been top-left under the room search (CampusMapView), which
 * is the placement the Mac borrowed. Its buttons stay btn-xs — the extension
 * is drawn 1:1 in a browser, not at the Mac's 0.825, so it never had the
 * 20pt-button problem. Both halves are pinned, so neither drifts alone.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('the floor column on a Mac and in the extension', () => {
  it('the desktop tree keeps its column top-left under the search, at the default size', () => {
    const view = read('components/CampusMap/CampusMapView.tsx');
    expect(view).toMatch(/absolute top-3 left-3[^"]*">\s*<RoomSearch \/>\s*<FloorStack \/>/);
  });

  it('the phone tree stands it top-left without a touch screen, and beside the rail with one', () => {
    const switcher = read('components/mobile/screens/map/FloorSwitcher.tsx');
    expect(switcher).toContain('floorColumnPlacement(');
    expect(switcher).toContain('isTouch');
    expect(switcher).toContain('absolute left-4 top-[calc(5rem');
    expect(switcher).toContain('<FloorStack size={place.size} />');
  });

  it('FloorStack defaults to the size the desktop tree has always had', () => {
    expect(read('components/CampusMap/FloorStack.tsx')).toContain("size = 'xs'");
  });
});
