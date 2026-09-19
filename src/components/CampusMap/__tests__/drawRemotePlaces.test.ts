import { describe, it, expect, vi } from 'vitest';
import L from 'leaflet';
import { drawRemotePlaces, REMOTE } from '../remoteLayers';
import type { useAppStore } from '../../../store/useAppStore';

/**
 * The renderer, not the policy.
 *
 * `walksThrough` is tested on its own, but the bug review caught did not live
 * in the predicate — it lived here, in the wiring that decides which shapes get
 * a click handler. A test one level up would not have seen it.
 */
const draw = () => {
  const layer = L.layerGroup();
  const select = {
    selectMapPoi: vi.fn(),
    focusRemotePlaceById: vi.fn(),
  } as unknown as ReturnType<typeof useAppStore.getState>;
  drawRemotePlaces(layer, select);
  return { layer, select, layers: layer.getLayers() };
};

/** The polygons carrying a given place's name as their tooltip. */
const named = (layers: L.Layer[], name: string): L.Polygon[] =>
  layers.filter(
    (l): l is L.Polygon =>
      l instanceof L.Polygon && (l.getTooltip()?.getContent() as string | undefined) === name
  );

const GARDEN = 'Botanická zahrada a arboretum';
const LICHA = 'Panská lícha';

describe('drawRemotePlaces', () => {
  it('selects nothing when the arboretum is clicked, and lets the tap through', () => {
    // Asserted on BEHAVIOUR, not on `listens('click')`: bindTooltip registers a
    // click listener of its own on touch devices (that is how a tap shows the
    // name), so "has no listener" is true of nothing here.
    const { layers, select } = draw();
    const [grounds] = named(layers, GARDEN);
    expect(grounds).toBeDefined();
    grounds!.fire('click');
    expect(select.selectMapPoi).not.toHaveBeenCalled();
    expect(select.focusRemotePlaceById).not.toHaveBeenCalled();
    expect(grounds!.options.bubblingMouseEvents).toBe(true);
  });

  it('keeps every Panská lícha shape selectable, though it has an `area` too', () => {
    // The regression: inertness was first derived from `!!place.area`, which is
    // true of Panská lícha as well. Asserted on the renderer because that is
    // where it broke — twice, in fact. The second time only its GROUNDS had
    // lost the handler, while the fix to its buildings looked right, and a test
    // one level up on the predicate saw nothing wrong.
    const count = named(draw().layers, LICHA).length;
    expect(count).toBeGreaterThan(1); // its grounds AND its buildings
    for (let i = 0; i < count; i++) {
      const fresh = draw();
      named(fresh.layers, LICHA)[i]!.fire('click');
      expect(fresh.select.selectMapPoi).toHaveBeenCalledTimes(1);
    }
  });

  it('draws the footpaths with nothing selected at all', () => {
    // They used to appear only after clicking the garden, which hid the one
    // genuinely useful thing about it behind knowing it was there.
    const garden = REMOTE.find((p) => p.shortName === GARDEN)!;
    const { layers } = draw();
    const lines = layers.filter((l) => l instanceof L.Polyline && !(l instanceof L.Polygon));
    expect(lines).toHaveLength(garden.paths!.length);
  });

  it('draws the collections, and pins none of their names to the map', () => {
    const garden = REMOTE.find((p) => p.shortName === GARDEN)!;
    const { layers } = draw();
    const dots = layers.filter((l) => l instanceof L.CircleMarker);
    expect(dots).toHaveLength(garden.pois!.length);
    for (const d of dots) expect(d.getTooltip()?.options.permanent).toBeFalsy();
  });
});
