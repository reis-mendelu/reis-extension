import { useEffect } from 'react';
import L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import { drawRoute, drawPosition } from './routeLayers';
import { railPaddingPx } from '../../utils/mapRail';
import type { CanvasRefs } from './useCanvasRefs';

export function useRouteCamera(refs: CanvasRefs, isPhone: boolean): void {
  const { ref, mapRef, routeLayerRef, positionLayerRef, railRef } = refs;
  // The route chip says how long the walk takes, so it has to be written in the
  // student's language. Read here rather than inside the Leaflet layer, which is
  // not a component and has no hooks.
  const language = useAppStore((s) => s.language);
  const routeWalk = useAppStore((s) => s.routeWalk);
  const routeFrom = useAppStore((s) => s.routeFrom);
  // Drawing the route is a restyle of its own layer, never a redraw of the map
  // — the heavy effect owns the layers, and re-running it here would throw away
  // the floor the student is looking at.
  //
  // The CAMERA does move, though, and it has to. The route is the answer to a
  // question the student just asked, and the first version of this drew it
  // wherever it happened to fall: walking to Q from the main gate put the whole
  // line south of the viewport, behind the sheet, with only the card to say it
  // had worked at all. So the map fits the walk. Bottom padding clears the
  // sheet, which owns roughly the lower third of a phone screen; without it the
  // fit is honest about the bounds and still hides half the line.
  useEffect(() => {
    drawRoute(routeLayerRef.current, routeWalk, language);
    drawPosition(positionLayerRef.current, routeFrom);
    const map = mapRef.current;
    if (!map) return;
    // No walk, but we know where they are: put THEM on screen. Saying "the
    // garden is shut" over a map centred on nothing was the version that shipped.
    if (!routeWalk || routeWalk.coords.length < 2) {
      if (routeFrom) map.setView(L.latLng(routeFrom[1], routeFrom[0]), Math.max(map.getZoom(), 16));
      return;
    }
    const shown = routeWalk;
    // Padding measured off the real chrome, not guessed. The first version
    // padded the top by 96 for a card whose bottom is at 263 — so the route's
    // own start dot sat behind it — and the bottom by 0.4 of the viewport for a
    // sheet that was 45% of it. Both were wrong in the direction that hides the
    // thing the student just asked for.
    //
    // Read from the DOM rather than recomputed: the sheet animates between
    // three detents and drags to arbitrary heights, so its class is not the
    // authority on how tall it is right now.
    const sheetEl = document.querySelector('[data-testid="map-sheet"]');
    const sheetH = sheetEl ? Math.round(sheetEl.getBoundingClientRect().height) : 0;
    const searchEl = ref.current?.parentElement?.querySelector('label');
    const topChrome = searchEl
      ? Math.round(
          searchEl.getBoundingClientRect().bottom - (ref.current?.getBoundingClientRect().top ?? 0)
        )
      : 78;
    // The rail overlays the RIGHT of the map in landscape, so the destination
    // and its time chip finish underneath it unless its width is reserved.
    //
    // Through the same tested rule the camera shift uses, not off the store.
    // `mapRailOpen` defaults to true and `mapRailWidth` to 340 on every device,
    // including the phones that never render a rail — so this reserved 368px of
    // a 390px map, left Leaflet nothing to fit into, and the camera never
    // moved. See railPaddingPx.
    const rail = railPaddingPx(
      map.getSize().x,
      isPhone,
      railRef.current.width,
      railRef.current.open
    );
    map.fitBounds(L.latLngBounds(shown.coords.map(([lon, lat]) => L.latLng(lat!, lon!))), {
      paddingTopLeft: [28, topChrome + 12],
      paddingBottomRight: [28 + rail, sheetH + 12],
      // A 1.3 km walk and a 160 m one both deserve to fill the frame, but not
      // past the point where the basemap stops carrying street names.
      maxZoom: 18,
      animate: true,
    });
  }, [
    routeWalk,
    routeFrom,
    language,
    isPhone,
    ref,
    mapRef,
    routeLayerRef,
    positionLayerRef,
    railRef,
  ]);
}
