import { useEffect, useState } from 'react';
import { isoCoversView } from '../../../data/map/isoView';
import { subscribeMapInstance } from '../mapInstance';

/**
 * Whether the isometric map has anything to show for where the 2D map is looking.
 * The picture covers the campus and its surroundings only, so a student who has
 * panned the 2D map to another part of town gets a cube that says so instead of
 * one that opens on a place they were not looking at. True while there is no 2D
 * map to ask. Follows the camera on `moveend`, not on every frame of a drag.
 */
export function useIsoMapReachable(): boolean {
  const [reachable, setReachable] = useState(true);
  useEffect(() => {
    let stop = () => {};
    const unsubscribe = subscribeMapInstance((map) => {
      stop();
      stop = () => {};
      if (!map) {
        setReachable(true);
        return;
      }
      const check = () => {
        const c = map.getCenter();
        setReachable(isoCoversView({ lat: c.lat, lng: c.lng, zoom: map.getZoom() }));
      };
      check();
      map.on('moveend', check);
      stop = () => map.off('moveend', check);
    });
    return () => {
      unsubscribe();
      stop();
    };
  }, []);
  return reachable;
}
