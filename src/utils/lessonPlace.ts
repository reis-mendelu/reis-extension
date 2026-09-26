import type { BlockLesson } from '../types/calendarTypes';
import type { MapEvent, Society } from '../types/events';
import type { RoomIndexEntry } from '../types/campusMap';
import roomsIndexJson from '../data/map/rooms-index.json';
import { localizedRoom } from './localizedLesson';
import { lookupRoomTarget } from './rooms/lookupRoomPlace';
import { eventIdFromRsvpBlock } from './rsvpBlocks';

const INDEX = roomsIndexJson as RoomIndexEntry[];

export interface LessonPlace {
  /** What the row prints where a room goes; '' when there is nothing to say. */
  label: string;
  /** The society event behind an answered block, when the map can show it. */
  eventId: string | null;
  /** Whether "show on map" has anywhere to go. */
  onMap: boolean;
  /**
   * Whether there is a walk behind it. A room with no floor plan still has
   * `onMap` (the map shows its building), but the routing graph only reaches
   * rooms the map draws, so "Trasa" must not appear for one.
   */
  routable: boolean;
  /**
   * The society running an answered event ("ESN"), for the slot a lesson gives
   * its teacher. Read from the catalog directly rather than `resolveSociety`,
   * whose neutral fallback would print the raw id: an unknown id names no host.
   */
  host: string | null;
}

/**
 * Where a calendar row is — the phone's agenda and "up next" card, and the
 * desktop grid's room line (which takes only the label: no map button there).
 *
 * A lesson's place is its room, and the map can show it only when the room
 * index knows it. An answered society event is different: it reaches the
 * calendar as a block (`planRsvpBlocks`) whose only place is a room string
 * copied from `event.location`, and a society can place an event with a pin and
 * no name at all. That block printed an empty room, and the room index — the
 * only thing the pin asked — never knows a venue in town. So the event itself is
 * asked instead: its name, or "Místo na mapě" when it has only a pin, exactly as
 * the map's own list says it (`EventRow`), and a map target whenever it has a
 * coordinate.
 *
 * `onMapLabel` comes in translated, so this stays pure; the block keeps no
 * translated string, because it is persisted and reconciled field by field.
 */
export function lessonPlace(
  lesson: BlockLesson,
  language: string,
  events: readonly MapEvent[],
  onMapLabel: string,
  societies: Record<string, Society>
): LessonPlace {
  const room = localizedRoom(lesson, language);
  const eventId = lesson.isCustom ? eventIdFromRsvpBlock(lesson.customEventId ?? '') : null;
  if (eventId === null) {
    // The room itself, or the building/campus it is in when there is no floor
    // plan (T18 → building T) — either way the map has somewhere to go.
    const target = lookupRoomTarget(lesson.room, INDEX);
    return {
      label: room,
      eventId: null,
      onMap: !!target,
      routable: target?.kind === 'room',
      host: null,
    };
  }

  const event = events.find((e) => e.id === eventId);
  // Cold start: the blocks come back from IndexedDB before the events do.
  if (!event) return { label: room, eventId: null, onMap: false, routable: false, host: null };

  const host = societies[event.societyId]?.shortName ?? null;
  const named = event.location?.trim();
  if (!event.coord)
    return { label: named || room, eventId: null, onMap: false, routable: false, host };
  return { label: named || onMapLabel, eventId: event.id, onMap: true, routable: true, host };
}
