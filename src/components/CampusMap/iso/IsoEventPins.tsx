import { useCallback, useEffect, useMemo, useState } from 'react';
import type OpenSeadragon from 'openseadragon';
import { useVisibleMapEvents } from '../../../hooks/useVisibleMapEvents';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { groupEventsByVenue, parseEventDate } from '../eventHelpers';
import { isSoonEvent, localTodayIso } from '../eventWindow';
import { EventPin } from '../EventPin';
import { isoPointFromLatLng } from '../../../data/map/isoView';
import { trackMapEventView } from '../../../api/featureUsage';

type Osd = typeof OpenSeadragon;
interface Placed {
  key: string;
  x: number;
  y: number;
}

/**
 * The 2D map's event pins, on the isometric picture: the same pins, the same events
 * (what is on soon, filtered for this student), at the place the 2D map would put them.
 * A pin's spot is its geographic coordinate run through the picture's projection, so
 * nothing is stored per event. They are re-placed from OpenSeadragon's own viewport on
 * every frame it moves, so they stay glued to the buildings while panning and zooming.
 */
export function IsoEventPins({
  viewer,
  osd,
  selectedId,
  onSelect,
}: {
  viewer: OpenSeadragon.Viewer;
  osd: Osd;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const { language } = useTranslation();
  const visible = useVisibleMapEvents();
  const todayIso = useAppStore((s) => localTodayIso(s.now));
  const groups = useMemo(
    () =>
      groupEventsByVenue(
        visible.filter((e) => isSoonEvent(e, parseEventDate(todayIso)) || e.id === selectedId)
      ).flatMap((g) => {
        // Event coordinates are [lng, lat]; a venue off the picture has no pin here.
        const at = isoPointFromLatLng(g.coord[1], g.coord[0]);
        return at ? [{ group: g, at }] : [];
      }),
    [visible, todayIso, selectedId]
  );
  const [placed, setPlaced] = useState<Placed[]>([]);

  const place = useCallback(() => {
    const w = viewer.container.clientWidth;
    const h = viewer.container.clientHeight;
    setPlaced(
      groups.flatMap(({ group, at }) => {
        const p = viewer.viewport.pixelFromPoint(new osd.Point(at.x, at.y), true);
        // Off screen (with a pin's own radius to spare): not drawn, not tabbable.
        return p.x < -20 || p.y < -20 || p.x > w + 20 || p.y > h + 20
          ? []
          : [{ key: group.key, x: p.x, y: p.y }];
      })
    );
  }, [viewer, osd, groups]);

  // A tapped pin is brought into the upper half, clear of the card that opens under it.
  useEffect(() => {
    const hit = groups.find(({ group }) => group.events.some((e) => e.id === selectedId));
    if (!hit) return;
    const { viewport, container } = viewer;
    const below = (container.clientHeight * 0.18) / container.clientWidth / viewport.getZoom(true);
    viewport.panTo(new osd.Point(hit.at.x, hit.at.y + below));
    // panTo does not keep the picture covering the screen by itself near its edge.
    viewport.applyConstraints();
    // Only when the selection changes: a re-grouping must not yank the map back.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  useEffect(() => {
    // Placed a frame later, not in the effect body: the viewer's own events do the rest.
    const first = requestAnimationFrame(place);
    const events = ['animation', 'animation-finish', 'update-viewport', 'open', 'resize'] as const;
    events.forEach((e) => viewer.addHandler(e, place));
    return () => {
      cancelAnimationFrame(first);
      events.forEach((e) => viewer.removeHandler(e, place));
    };
  }, [viewer, place]);

  const byKey = new Map(groups.map(({ group }) => [group.key, group]));
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" data-testid="iso-pins">
      {placed.map((p) => {
        const group = byKey.get(p.key);
        return group ? (
          <EventPin
            key={p.key}
            group={group}
            x={p.x}
            y={p.y}
            selected={group.events.some((e) => e.id === selectedId)}
            locale={language === 'en' ? 'en-US' : 'cs-CZ'}
            onSelect={(id) => {
              // A pin opened is the same map-view signal as on the 2D map.
              void trackMapEventView(id);
              onSelect(id);
            }}
          />
        ) : null;
      })}
    </div>
  );
}
