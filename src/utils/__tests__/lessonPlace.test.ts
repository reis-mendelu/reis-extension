import { describe, it, expect } from 'vitest';
import { lessonPlace } from '../lessonPlace';
import { customEventToLesson } from '../customEventLesson';
import { makeLesson } from '../../test/fixtures/lesson';

/** Where a calendar row says it is, and whether "show on map" has anywhere to go. */
describe('lessonPlace', () => {
  it('leaves a lesson to the room index', () => {
    expect(lessonPlace(makeLesson({ room: 'Q01' }), 'cz')).toEqual({
      label: 'Q01',
      onMap: true,
      routable: true,
    });
    expect(lessonPlace(makeLesson({ room: 'Lesní škola Jezírko (ŠLP)' }), 'cz').onMap).toBe(false);
  });

  // No floor plan, but the building or campus is on the map (isRoomPlaces.json).
  it.each([
    ['T18', true],
    ['ZFAC1 (Led)', true],
    ['ucebna_utechov (Sob)', true], // Areál Útěchov
    ['Lesní škola Jezírko (ŠLP)', false], // a self-contradicting IS record
  ])('offers the map for %s: %s', (room, onMap) => {
    expect(lessonPlace(makeLesson({ room }), 'cz').onMap).toBe(onMap);
  });

  // The routing graph reaches only rooms the map draws; "Trasa" over a building
  // pin would be a walk that does not exist.
  it.each([
    ['Q01', true],
    ['T18', false],
  ])('%s is routable: %s', (room, routable) => {
    expect(lessonPlace(makeLesson({ room }), 'cz').routable).toBe(routable);
  });

  it('says nothing about an entry the student typed in without a room', () => {
    const own = customEventToLesson({
      id: 'custom-1',
      title: 'Zubař',
      date: '20260924',
      startTime: '08:00',
      endTime: '09:00',
    });
    expect(lessonPlace(own, 'cz')).toEqual({ label: '', onMap: false, routable: false });
  });
});
