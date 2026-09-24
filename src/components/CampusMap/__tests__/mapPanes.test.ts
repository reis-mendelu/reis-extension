import { describe, it, expect, vi } from 'vitest';
import type L from 'leaflet';
import { flyAndReveal } from '../mapLayers';
import {
  EVENTS_PANE,
  LABELS_PANE,
  LEAFLET_PANE_NAMES,
  REIS_PANE_Z,
  TOOLTIP_CARVE_OUTS,
  ensurePane,
  ensureReisPanes,
} from '../mapPanes';

/** A map that hands out one element per pane name, like Leaflet's own. */
function fakeMap() {
  const panes = new Map<string, HTMLElement>();
  for (const n of LEAFLET_PANE_NAMES) panes.set(n, document.createElement('div'));
  const moveend: (() => void)[] = [];
  return {
    panes,
    moveend,
    getPane: (n: string) => panes.get(n),
    createPane: (n: string) => {
      const el = document.createElement('div');
      panes.set(n, el);
      return el;
    },
    once: (_e: string, fn: () => void) => void moveend.push(fn),
  };
}

describe('ensurePane', () => {
  it('creates the pane and pins the z-index the order was decided at', () => {
    const map = fakeMap();
    const pane = ensurePane(map as unknown as L.Map, EVENTS_PANE);
    expect(pane.style.zIndex).toBe(String(REIS_PANE_Z[EVENTS_PANE]));
    // Pins and labels are things to look at: the polygons underneath stay
    // clickable, and EventPin re-enables pointer events on the button itself.
    expect(pane.style.pointerEvents).toBe('none');
  });

  it('is idempotent and re-pins a z-index something else overwrote', () => {
    const map = fakeMap();
    const first = ensurePane(map as unknown as L.Map, LABELS_PANE);
    first.style.zIndex = '99';
    expect(ensurePane(map as unknown as L.Map, LABELS_PANE)).toBe(first);
    expect(first.style.zIndex).toBe(String(REIS_PANE_Z[LABELS_PANE]));
  });

  it('gives the labels a pane of their own, under the event pins', () => {
    const map = fakeMap();
    ensureReisPanes(map as unknown as L.Map);
    const labels = Number(map.getPane(LABELS_PANE)!.style.zIndex);
    const events = Number(map.getPane(EVENTS_PANE)!.style.zIndex);
    expect(labels).toBeLessThan(events);
  });
});

describe('flyAndReveal', () => {
  /**
   * The building letters were carved out of `tooltipPane` into a pane of their
   * own. `flyAndReveal` hides the vector and label panes for the duration of a
   * camera move because they are re-projected only on `moveend` — a pane it
   * forgets flashes its labels at the pre-fly position while the basemap
   * animates out from under them. So the list of panes it hides is not a
   * hardcoded pair; it is "and every carve-out".
   */
  it('hides every pane carved out of the tooltip pane, then reveals it', () => {
    vi.useFakeTimers();
    const map = fakeMap();
    ensureReisPanes(map as unknown as L.Map);
    const hidden: string[] = [];
    flyAndReveal(map as unknown as L.Map, () => {
      for (const name of ['overlayPane', 'tooltipPane', ...TOOLTIP_CARVE_OUTS])
        if (map.getPane(name)!.style.visibility === 'hidden') hidden.push(name);
    });
    expect(hidden).toEqual(['overlayPane', 'tooltipPane', ...TOOLTIP_CARVE_OUTS]);

    map.moveend.forEach((fn) => fn());
    for (const name of ['overlayPane', 'tooltipPane', ...TOOLTIP_CARVE_OUTS])
      expect(map.getPane(name)!.style.visibility).toBe('');
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });
});
