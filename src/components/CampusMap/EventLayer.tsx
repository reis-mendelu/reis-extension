import { useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useVisibleMapEvents } from '../../hooks/useVisibleMapEvents';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { groupEventsByVenue, parseEventDate } from './eventHelpers';
import { groupEventsInBuilding } from './inBuildingEvents';
import { floorText } from './floorText';
import roomsIndexJson from '../../data/map/rooms-index.json';
import type { RoomIndexEntry } from '../../types/campusMap';
import { useEventPinPlacement } from './useEventPinPlacement';
import { EventPin } from './EventPin';
import { DraftPin } from './DraftPin';
import { useSociety } from '../../hooks/useSociety';
import { isSoonEvent, localTodayIso } from './eventWindow';
import { trackMapEventView } from '../../api/featureUsage';

const ROOM_INDEX = roomsIndexJson as RoomIndexEntry[];

// The pins live in their own Leaflet pane — a child of the map pane, so Leaflet
// translates it for free while panning and pins stay glued with no JS. Which
// pane, and where it sits in the paint order, is decided in mapPanes.ts: this
// used to be a bare `640` here, which put every pin (and its hover bubble)
// underneath Leaflet's tooltip pane, i.e. underneath the lettered building names.

// HTML pins (not Leaflet markers) so the balloons can use Tailwind/DaisyUI and
// hover bubbles, but rendered INTO a Leaflet pane via a portal. Positions are
// LAYER points (relative to the map pane), so panning moves them for free. On a
// zoom they ride the animation exactly like native markers: `zoomanim` moves
// each pin to its post-zoom layer point and the `leaflet-zoom-animated` class
// transitions the transform in sync with the basemap. zoomend/viewreset settle
// the exact positions. In a building's floor view only the events whose room is
// in THAT building stay, each at its room (see inBuildingEvents).
export function EventLayer() {
  // One layer, two hosts: the student map draws the public feed, the admin
  // console's map draws the active society's own events (all of them, whatever
  // their date — the student pins keep to the soon horizon).
  const authoring = useAppStore((s) => s.adminConsoleOpen);
  // The student's own view of the public feed: a society can mark an event for
  // its followers only, and this is where that is honoured.
  const publicEvents = useVisibleMapEvents();
  const societyEvents = useAppStore((s) => s.societyMapEvents);
  const selection = useAppStore((s) => s.mapSelection);
  const selectedId = selection?.kind === 'event' ? selection.event.id : null;
  // Students' pins show what is on SOON: the catalog list carries the whole
  // semester, and a semester of pins would bury the campus. A society authoring
  // in the console still sees every one of its own events. The SELECTED event
  // is pinned whatever its date: a "Později" row or a calendar RSVP block flies
  // the camera to it, and without its pin the fly lands on an empty map.
  // Memoized: `.filter()` makes a new array every call, and the `groups` memo
  // and its re-project effect below key off this reference — an unmemoized
  // filter here reruns them every render and never settles. Keyed on the
  // selected EVENT's id, not the selection object: a new selection object for
  // the same event (or a room picked with no event selected) does not rebuild
  // it; moving off an event does, since its id stops being exempt.
  // "Soon" is measured from the store's clock, selected as the local DAY so the
  // pulse's per-second tick re-renders nothing: a map left open across
  // midnight drops yesterday's pins and gains the day that came into range.
  const todayIso = useAppStore((s) => localTodayIso(s.now));
  const events = useMemo(
    () =>
      authoring
        ? // A notice is Novinky-only; the public feed never carries one, and
          // the society's map must not pin what students will not see there.
          societyEvents.filter((e) => e.kind !== 'notice')
        : publicEvents.filter(
            (e) => isSoonEvent(e, parseEventDate(todayIso)) || e.id === selectedId
          ),
    [authoring, societyEvents, publicEvents, selectedId, todayIso]
  );
  const activeBuildingId = useAppStore((s) => s.activeBuildingId);
  const activeFloorId = useAppStore((s) => s.activeFloorId);
  const buildingRooms = useAppStore((s) =>
    s.activeBuildingId === null ? undefined : s.roomsByBuilding[s.activeBuildingId]
  );
  const focusEvent = useAppStore((s) => s.focusEventById);
  // The in-progress event location: only meaningful while the composer is open.
  const composerOpen = useAppStore((s) => s.composerOpen);
  const draftCoord = useAppStore((s) => s.draftCoord);
  const assocId = useAppStore((s) => s.adminActiveAssociationId);
  const beginPlacing = useAppStore((s) => s.beginPlacing);
  const { language, t } = useTranslation();
  const activeDraft = composerOpen ? draftCoord : null;
  // A pin opened on the student map is the map-view signal. NOT while
  // authoring: the admin console renders this same layer over a society's own
  // events, and a society checking its own listing is not a student looking at
  // it. Tracked here rather than inside `focusEventById`, because that action
  // is also how a Novinky feed click and the admin console's own list open an
  // event — both of which would arrive as map views.
  const selectEvent = (id: string) => {
    if (!authoring) void trackMapEventView(id);
    // In a floor view the tap selects in place; the overview call is unchanged.
    if (activeBuildingId === null) focusEvent(id);
    else focusEvent(id, { keepBuilding: true });
  };
  const draftSociety = useSociety(assocId);
  const draftColor = draftSociety?.color ?? '#0046a0';
  // Events are loaded by the store (initializeStore + language handlers), not a
  // fetch-in-useEffect here — this layer stays presentational over store state.

  const groups = useMemo(() => {
    // Every event the caller's source gave us. The society filter that used to
    // narrow this is gone with its chips, which also ends the class of bug it
    // kept producing: a stored choice applied to a surface with no control to
    // clear it, so the pins and the list beside them disagreed.
    return activeBuildingId === null
      ? groupEventsByVenue(events)
      : groupEventsInBuilding(events, activeBuildingId, activeFloorId, buildingRooms, ROOM_INDEX);
  }, [events, activeBuildingId, activeFloorId, buildingRooms]);
  const { placed, draftPt, pane } = useEventPinPlacement(groups, activeDraft);

  // The draft pin can be the only thing to show (placing a first event with no
  // saved events yet), so don't bail on an empty `placed` when a draft exists.
  // The draft is a campus-overview placement: placing and previewing both leave
  // floor view first, so it is not drawn over a floor plan.
  const shownDraft = activeBuildingId === null ? draftPt : null;
  // `placed` is rebuilt in an effect, one frame behind `groups`. On a building
  // change that frame would draw the previous view's pins (the overview's, or
  // the other floor's flags), so draw only what the current groups still hold,
  // from the current group.
  const liveGroups = new Map(groups.map((g) => [g.key, g]));
  const visible = placed.flatMap((p) => {
    const group = liveGroups.get(p.key);
    return group ? [{ ...p, group }] : [];
  });
  if (!pane || (visible.length === 0 && !shownDraft)) return null;

  return createPortal(
    <>
      {visible.map((p) => (
        <EventPin
          key={p.key}
          group={p.group}
          x={p.x}
          y={p.y}
          selected={p.group.events.some((e) => e.id === selectedId)}
          otherFloor={p.group.otherFloor}
          floorLevel={p.group.floorLevel}
          floorLabel={
            p.group.otherFloor && p.group.floorLevel != null
              ? floorText(p.group.floorLevel, t)
              : undefined
          }
          locale={language === 'en' ? 'en-US' : 'cs-CZ'}
          onSelect={selectEvent}
        />
      ))}
      {shownDraft && (
        <DraftPin
          x={shownDraft.x}
          y={shownDraft.y}
          color={draftColor}
          label={t('map.draftPinLabel')}
          onClick={beginPlacing}
        />
      )}
    </>,
    pane
  );
}
