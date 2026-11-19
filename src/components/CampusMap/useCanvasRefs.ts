import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import type { RoomPoly } from './roomTints';
import type { RoomProperties } from '../../types/campusMap';

/**
 * Every ref MapCanvas and its hooks share: the Leaflet map, its layer groups,
 * and the "latest value" refs the camera reads without re-running on them.
 */
export function useCanvasRefs() {
  /**
   * The rail's live geometry, held in a ref rather than read as a dependency.
   *
   * The camera compensation has to track the CURRENT width — a fixed half-of-340
   * leaves the pin under a rail just dragged wider — but `railWidth` in the big
   * effect's dependency array made every frame of a drag re-run an effect that
   * clears layers and calls `setView`/`fitBounds`, throwing away the camera
   * position the student had. A ref gives the value at the moment of focus
   * without making the width a trigger.
   */
  const railWidth = useAppStore((s) => s.mapRailWidth);
  const railOpen = useAppStore((s) => s.mapRailOpen);
  const railRef = useRef({ width: railWidth, open: railOpen });
  // Synced in an effect, not written during render: a ref assigned mid-render
  // can leave a stale value behind when React discards a render, and the lint
  // rule that says so is right.
  useEffect(() => {
    railRef.current = { width: railWidth, open: railOpen };
  }, [railWidth, railOpen]);
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup>(L.layerGroup());
  const exitHandlerRef = useRef<((e: L.LeafletMouseEvent) => void) | null>(null);
  // Set only by the floor-view tap-away, so the redraw below can tell "I'm done
  // with this building" (leave the camera where the finger left it) from any
  // other caller of `exitToCampus`, which means "take me back to the whole
  // campus" and should fly there.
  const keepViewRef = useRef(false);
  // Live room polygons keyed by placeId, with their unselected base style — lets
  // a plain map click re-highlight in place without a full redraw or camera move.
  const roomPolysRef = useRef<Map<number, RoomPoly>>(new Map());
  /** The open floor's named rooms, so venue names that arrive after the plan
   *  was drawn retitle it in place (a redraw moves the camera). */
  const labelledRoomsRef = useRef<{ poly: L.Polygon; p: RoomProperties; big: boolean }[]>([]);
  /** The "Najdi cestu" pill pinned to the selected room. Its own group, so a
   *  selection change never redraws the plan — a redraw moves the camera. */
  const roomChipRef = useRef<L.LayerGroup>(L.layerGroup());
  /** The open floor plan's building, so the label rule can be re-asked on every
   *  camera settle without re-running the effect that owns the camera. */
  const planBoundsRef = useRef<L.LatLngBounds | null>(null);
  /** The campus building outlines, kept so a restyle never needs a redraw
   *  (a redraw moves the camera). */
  const buildingPolysRef = useRef<Map<string, L.Polygon>>(new Map());
  /** The footprint of a chosen building the map has only a point for (D, T…).
   *  Its own group, redrawn on selection alone: the overview effect neither
   *  re-runs on a selection nor survives one clearing. */
  const poiHighlightRef = useRef<L.LayerGroup>(L.layerGroup());
  // The computed route lives in its OWN layer group, added straight to the map
  // rather than to `layerRef`. The heavy effect below clears and rebuilds that
  // group whenever the building or floor changes, and a route drawn into it
  // would vanish on any of those — including the camera move that follows a
  // route being drawn in the first place.
  const routeLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  /** "You are here", independent of whether a route exists. */
  const positionLayerRef = useRef<L.LayerGroup>(L.layerGroup());
  const draftCoord = useAppStore((s) => s.draftCoord);
  // Same "latest ref" trick, same reason: moving the draft pin (picking a
  // different room) must not re-fly the camera. Only an explicit request does,
  // and that arrives as a change to draftFocusReq.
  const draftCoordRef = useRef(draftCoord);
  useEffect(() => {
    draftCoordRef.current = draftCoord;
  }, [draftCoord]);

  // One object for the life of the canvas: the hooks list it as a dependency,
  // the camera-owning effect included. Lazy state, not useMemo, because React
  // may drop a memo, and a new object would re-run that effect and move the
  // camera. The refs themselves are stable, so the first render's are the ones.
  const [refs] = useState(() => ({
    railRef,
    ref,
    mapRef,
    layerRef,
    exitHandlerRef,
    keepViewRef,
    roomPolysRef,
    labelledRoomsRef,
    roomChipRef,
    planBoundsRef,
    buildingPolysRef,
    poiHighlightRef,
    routeLayerRef,
    positionLayerRef,
    draftCoordRef,
  }));
  return refs;
}

export type CanvasRefs = ReturnType<typeof useCanvasRefs>;
