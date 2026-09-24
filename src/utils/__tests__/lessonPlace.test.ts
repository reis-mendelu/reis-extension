import { describe, it, expect } from 'vitest';
import { lessonPlace } from '../lessonPlace';
import { customEventToLesson } from '../customEventLesson';
import { rsvpBlockId } from '../rsvpBlocks';
import { makeLesson } from '../../test/fixtures/lesson';
import type { MapEvent } from '../../types/events';

const ON_MAP = 'Místo na mapě';

function mapEvent(over: Partial<MapEvent> = {}): MapEvent {
  return {
    id: 'evt-1',
    title: 'City Game, bring a pen :)',
    url: '',
    date: '2026-09-24',
    endDate: null,
    time: '18:30',
    location: null,
    imageUrl: null,
    organizerKey: 'mendelu',
    societyId: 'esn',
    coord: [16.6077, 49.1976],
    roomCode: null,
    venueKind: 'offcampus',
    category: 'other',
    ...over,
  };
}

const block = (room?: string) =>
  customEventToLesson({
    id: rsvpBlockId('evt-1'),
    title: 'City Game, bring a pen :)',
    date: '20260924',
    startTime: '18:30',
    endTime: '20:00',
    room,
  });

/**
 * Where a calendar row says it is, and whether "show on map" has anywhere to go.
 *
 * An answered society event reaches the calendar as a block that can only carry
 * a room string, filled from `event.location`. The City Game was placed with a
 * pin and no place name — `location` null, a coordinate and nothing else — so
 * its row printed " · 18:30 – 20:00" and, because the pin was gated on the room
 * index, never offered the map. Every one of the six events in production is
 * off campus, so no answered event could ever show the pin.
 */
describe('lessonPlace', () => {
  it('names a pin-only event the way the map list does, and points at the event', () => {
    expect(lessonPlace(block(), 'cz', [mapEvent()], ON_MAP)).toEqual({
      label: ON_MAP,
      eventId: 'evt-1',
      onMap: true,
      host: 'ESN',
    });
  });

  it('uses the place name a society typed in', () => {
    const place = lessonPlace(
      block('Klub Fléda'),
      'cz',
      [mapEvent({ location: 'Klub Fléda' })],
      ON_MAP
    );
    expect(place).toEqual({ label: 'Klub Fléda', eventId: 'evt-1', onMap: true, host: 'ESN' });
  });

  it('falls back to the block when the events have not loaded yet', () => {
    // Cold start: blocks come from IndexedDB before the event fetch lands. No
    // event to fly to, so no pin — and no crash.
    expect(lessonPlace(block('Klub Fléda'), 'cz', [], ON_MAP)).toEqual({
      label: 'Klub Fléda',
      eventId: null,
      onMap: false,
      host: null,
    });
  });

  it('offers no map for an event with no coordinate', () => {
    const place = lessonPlace(block(), 'cz', [mapEvent({ coord: null })], ON_MAP);
    expect(place).toEqual({ label: '', eventId: null, onMap: false, host: 'ESN' });
  });

  it('leaves a lesson to the room index', () => {
    expect(lessonPlace(makeLesson({ room: 'Q01' }), 'cz', [], ON_MAP)).toEqual({
      label: 'Q01',
      eventId: null,
      onMap: true,
      host: null,
    });
    expect(lessonPlace(makeLesson({ room: 'ZFAC1' }), 'cz', [], ON_MAP).onMap).toBe(false);
  });

  it('says nothing about an entry the student typed in without a room', () => {
    const own = customEventToLesson({
      id: 'custom-1',
      title: 'Zubař',
      date: '20260924',
      startTime: '08:00',
      endTime: '09:00',
    });
    expect(lessonPlace(own, 'cz', [mapEvent()], ON_MAP)).toEqual({
      label: '',
      eventId: null,
      onMap: false,
      host: null,
    });
  });

  it('names no host rather than the wrong one for a society it does not know', () => {
    // `societyById` falls back to ESN; a row must not credit ESN with someone
    // else's event.
    const place = lessonPlace(block(), 'cz', [mapEvent({ societyId: 'nobody' })], ON_MAP);
    expect(place.host).toBeNull();
  });
});
