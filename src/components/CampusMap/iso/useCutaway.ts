import { useEffect, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import { cutawayFor } from '../../../data/map/isoCutaway';
import { isoMapBase, isoSeason } from '../../../data/map/isoMap';

/**
 * Lays the re-rendered patch of the picture for this building's floor over the viewer's picture,
 * so the real building ends at the floor. True once it is drawn; false while it loads, when
 * there is none, or when it could not be fetched (the caller then frosts the building instead).
 */
export function useCutaway(
  viewer: OpenSeadragon.Viewer,
  buildingId: number | null,
  level: number | null
): boolean {
  const [drawn, setDrawn] = useState<string | null>(null);
  const base = isoMapBase();
  const cut =
    buildingId === null || level === null || base === null
      ? null
      : cutawayFor(buildingId, level, isoSeason());
  const url = cut && `${base}/summer/${cut.file}`;
  const [x, y, width] = [cut?.x, cut?.y, cut?.width];

  useEffect(() => {
    if (!url || x === undefined || y === undefined || width === undefined) return;
    let cancelled = false;
    let item: OpenSeadragon.TiledImage | null = null;
    viewer.addTiledImage({
      tileSource: { type: 'image', url },
      x,
      y,
      width,
      success: (e) => {
        const loaded = (e as unknown as { item: OpenSeadragon.TiledImage }).item;
        // Gone by the time it loaded (another floor, the map closed): put it straight back.
        if (cancelled) return viewer.world.removeItem(loaded);
        item = loaded;
        setDrawn(url);
      },
    });
    return () => {
      cancelled = true;
      if (item) viewer.world.removeItem(item);
      setDrawn(null); // coming back to this floor starts frosted again until it is drawn
    };
  }, [viewer, url, x, y, width]);

  return url !== null && drawn === url;
}
