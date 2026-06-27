import { useEffect, useMemo, useRef, useState } from 'react';
import type L from 'leaflet';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useEventsFacultySettings } from '../../hooks/useEventsFacultySettings';
import { societyById } from '../../data/societies';
import { filterEvents, groupEventsByVenue, type VenueGroup } from './eventHelpers';
import { subscribeMapInstance } from './mapInstance';
import { EventPin } from './EventPin';

interface Placed { key: string; x: number; y: number; group: VenueGroup; }

// HTML overlay (not Leaflet markers) so the balloons can use Tailwind/DaisyUI and
// hover bubbles. Positions are recomputed from the live map on move/zoom — same
// approach as EdgeIndicators. Pins only show in campus overview, not floor-view.
export function EventLayer() {
  const events = useAppStore((s) => s.mapEvents);
  const eventFilter = useAppStore((s) => s.eventFilter);
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const selection = useAppStore((s) => s.mapSelection);
  const focusEvent = useAppStore((s) => s.focusEventById);
  const loadMapEvents = useAppStore((s) => s.loadMapEvents);
  const { subscribedFaculties } = useEventsFacultySettings();
  const { language } = useTranslation();
  const [placed, setPlaced] = useState<Placed[]>([]);

  useEffect(() => { void loadMapEvents(); }, [loadMapEvents]);

  const groups = useMemo(() => {
    const visible = filterEvents(events, eventFilter, (id) => societyById(id).facultyKey, subscribedFaculties);
    return groupEventsByVenue(visible);
  }, [events, eventFilter, subscribedFaculties]);

  // Recompute screen positions whenever the map moves or the visible groups change.
  const groupsRef = useRef(groups);
  const scheduleRef = useRef<(() => void) | null>(null);
  useEffect(() => { groupsRef.current = groups; scheduleRef.current?.(); }, [groups]);

  useEffect(() => {
    let map: L.Map | null = null;
    let rafId: number | null = null;
    const recompute = () => {
      if (!map) { setPlaced([]); return; }
      const next: Placed[] = groupsRef.current.map((g) => {
        const pt = map!.latLngToContainerPoint([g.coord[1], g.coord[0]]);
        return { key: g.key, x: pt.x, y: pt.y, group: g };
      });
      setPlaced(next);
    };
    const schedule = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => { rafId = null; recompute(); });
    };
    scheduleRef.current = schedule;
    const bind = (m: L.Map) => { m.on('move zoom moveend zoomend', schedule); schedule(); };
    const unbind = (m: L.Map) => { m.off('move zoom moveend zoomend', schedule); };
    const unsub = subscribeMapInstance((m) => {
      if (map) unbind(map);
      map = m;
      if (map) bind(map); else schedule();
    });
    return () => {
      scheduleRef.current = null;
      if (rafId !== null) cancelAnimationFrame(rafId);
      if (map) unbind(map);
      unsub();
    };
  }, []);

  if (activeBuildingId !== null || placed.length === 0) return null;
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[950]">
      {placed.map((p) => (
        <EventPin
          key={p.key}
          group={p.group}
          x={p.x}
          y={p.y}
          selected={p.group.events.some((e) => e.id === selectedId)}
          locale={language === 'en' ? 'en-US' : 'cs-CZ'}
          onSelect={focusEvent}
        />
      ))}
    </div>
  );
}
