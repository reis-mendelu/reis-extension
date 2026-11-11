import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Arriving on the map from another screen collapses the events on the PHONE
 * and the iPad only — Dominik, 11 November 2026: "on the extension, keep the
 * events open since there the map is huge but on the phone there's little
 * space".
 *
 * Both halves are pinned. The phone tree collapses its sheet on the way into
 * the Mapa tab (setMobileTab), sizes an arriving card to its top
 * (useMapCardDetent, MapSheet), and the iPad's rail closes for a room
 * (MapRail). The extension's Akce/Místa panel opens expanded and only the
 * student's own toggle changes it — a later "let's do the same on desktop" is
 * exactly how that panel would start disappearing on the big screen.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('map arrival: phone collapses, extension keeps the events open', () => {
  it('the phone collapses its sheet on the way into the map', () => {
    expect(read('store/slices/createMobileUiSlice.ts')).toMatch(
      /arriving \? \{ mapSheetState: 'peek'/
    );
    expect(read('components/mobile/screens/map/MapSheet.tsx')).toContain('useMapCardDetent');
  });

  it('the iPad rail closes for a room', () => {
    expect(read('components/mobile/screens/map/MapRail.tsx')).toMatch(
      /showsRoom\) setOpen\(false\)/
    );
  });

  it('the extension panel starts expanded', () => {
    expect(read('store/slices/createMapSlice.ts')).toContain('mapPanelCollapsed: false');
  });

  // Review on #666: the slice's own action is the way to collapse it, so the
  // guard is on who calls it — the panel's own button, nothing else.
  it('only the panel’s own button collapses it', () => {
    // Anything that reaches for the action, under any local name, or sets the
    // flag directly. The slice that defines it and the type that declares it
    // are not callers.
    const DEFINES = ['store/types.ts', 'store/slices/createMapSlice.ts'];
    const callers = sourceFiles(resolve(process.cwd(), 'src'))
      .filter((f) => !/__tests__|\/test\//.test(f))
      .map((f) => relative(resolve(process.cwd(), 'src'), f))
      .filter((f) => !DEFINES.includes(f))
      .filter((f) => /toggleMapPanelCollapsed|mapPanelCollapsed:\s*true/.test(read(f)));
    expect(callers).toEqual(['components/CampusMap/MapSidePanel.tsx']);
    // And there it is the button's click, not an effect.
    const panel = read('components/CampusMap/MapSidePanel.tsx');
    expect(panel).toMatch(/const (\w+) = useAppStore\(\(s\) => s\.toggleMapPanelCollapsed\)/);
    const name = /const (\w+) = useAppStore\(\(s\) => s\.toggleMapPanelCollapsed\)/.exec(
      panel
    )![1]!;
    const uses = panel.split(name).length - 1;
    expect(uses).toBe(2); // the declaration and onClick={…}
    expect(panel).toContain(`onClick={${name}}`);
  });
});

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.tsx?$/.test(e.name) ? [p] : [];
  });
}
