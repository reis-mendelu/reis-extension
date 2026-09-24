import type { BlockLesson } from '../../types/calendarTypes';
import type { MapEvent } from '../../types/events';
import type { RoomIndexEntry } from '../../types/campusMap';
import roomsIndexJson from '../../data/map/rooms-index.json';
import { localizedRoom } from '../localizedLesson';
import { lookupRoomEntry } from '../rooms/lookupRoom';
import { eventIdFromRsvpBlock } from '../rsvpBlocks';

const INDEX = roomsIndexJson as RoomIndexEntry[];

export interface LessonPlace {
  /** What the row prints where a room goes; '' when there is nothing to say. */
  label: string;
  /** The society event behind an answered block, when the map can show it. */
  eventId: string | null;
  /** Whether "show on map" has anywhere to go. */
  onMap: boolean;
}

/**
 * Where a calendar row is, for the phone's agenda and its "up next" card.
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
  onMapLabel: string
): LessonPlace {
  const room = localizedRoom(lesson, language);
  const eventId = lesson.isCustom ? eventIdFromRsvpBlock(lesson.customEventId ?? '') : null;
  if (eventId === null) {
    return { label: room, eventId: null, onMap: !!lookupRoomEntry(lesson.room, INDEX) };
  }

  const event = events.find((e) => e.id === eventId);
  // Cold start: the blocks come back from IndexedDB before the events do.
  if (!event) return { label: room, eventId: null, onMap: false };

  const named = event.location?.trim();
  if (!event.coord) return { label: named || room, eventId: null, onMap: false };
  return { label: named || onMapLabel, eventId: event.id, onMap: true };
}
