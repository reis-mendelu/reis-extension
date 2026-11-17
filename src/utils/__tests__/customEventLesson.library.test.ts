import { describe, it, expect } from 'vitest';
import { customEventToLesson } from '../customEventLesson';

describe('customEventToLesson, a library booking', () => {
  it('names the room and puts the library on the place line, in both languages', () => {
    const l = customEventToLesson({
      id: 'library:A1',
      title: 'Studovna v knihovně',
      date: '20261118',
      startTime: '17:00',
      endTime: '18:00',
      room: 'Týmová 2',
      libraryBooking: { featureId: 57627, selfServiceIds: ['S1'] },
    });
    expect(l).toMatchObject({
      courseNameCs: 'Týmová 2',
      courseNameEn: 'Team 2',
      roomCs: 'Knihovna',
      roomEn: 'Library',
      isCustom: true,
      customEventId: 'library:A1',
    });
  });

  it('leaves an own event as it was typed', () => {
    const l = customEventToLesson({
      id: 'x',
      title: 'Učení',
      date: '20261118',
      startTime: '10:00',
      endTime: '11:00',
      room: 'Q01',
    });
    expect(l).toMatchObject({ courseNameCs: 'Učení', roomCs: 'Q01' });
  });
});
