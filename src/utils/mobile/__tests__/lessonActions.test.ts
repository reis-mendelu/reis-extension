import { describe, it, expect } from 'vitest';
import { makeLesson } from '../../../test/fixtures/lesson';
import { routeSuggestionFor, subjectSheetFor } from '../lessonActions';

describe('lessonActions', () => {
  it('builds the subject drawer sheet from the lesson itself — no lookup, no day matching', () => {
    const lesson = makeLesson({ courseCode: 'EBC-AP', courseName: 'Architektura počítačů' });
    expect(subjectSheetFor(lesson)).toEqual({
      kind: 'subjectDrawer',
      courseCode: 'EBC-AP',
      courseName: 'Architektura počítačů',
    });
  });

  describe('routeSuggestionFor', () => {
    it('names the building to walk to and the room as the ROW printed it', () => {
      // Not the room index's friendliest name: Q31's nickname is "Učebna
      // bankovnictví Komerčka", and a button offering to walk the student to a
      // phrase they have never seen is not the row they just tapped.
      expect(routeSuggestionFor(makeLesson({ room: 'Q31 (Černá Pole)' }), 'cz')).toEqual({
        buildingName: 'Q',
        roomLabel: 'Q31',
      });
    });

    it('is null for a room the map cannot place, so no button is offered', () => {
      expect(routeSuggestionFor(makeLesson({ room: 'ZFAC1 (Led)' }), 'cz')).toBeNull();
    });

    // Z14 is on the map (budova Z has a floor plan) but the router has no nodes
    // there in v1, so offering "Doveď mě do Z14" would promise a walk that
    // cannot be drawn.
    it('is null for a room in a building the router cannot reach (budova Z)', () => {
      expect(routeSuggestionFor(makeLesson({ room: 'Z14 (ČP II.)' }), 'cz')).toBeNull();
    });

    it('takes the room name from the language the student is reading', () => {
      const lesson = makeLesson({ room: 'Q31', roomCs: 'Q31', roomEn: 'Q31 lecture room' });
      expect(routeSuggestionFor(lesson, 'en')?.roomLabel).toBe('Q31 lecture room');
    });
  });
});
