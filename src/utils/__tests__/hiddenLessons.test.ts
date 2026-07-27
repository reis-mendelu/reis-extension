import { describe, it, expect } from 'vitest';
import { isLessonHidden } from '../hiddenLessons';
import { makeLesson as lesson } from '../../test/fixtures/lesson';
import type { HiddenItems } from '../../types/calendarTypes';

function hidden(over: Partial<HiddenItems> = {}): HiddenItems {
    return { courses: [], events: [], ...over };
}

describe('isLessonHidden', () => {
    it('is not hidden when hiddenItems is empty', () => {
        expect(isLessonHidden(lesson({}), hidden())).toBe(false);
    });

    it('is hidden when the lesson id is in hiddenItems.events', () => {
        const l = lesson({ id: 'l1' });
        expect(isLessonHidden(l, hidden({ events: [{ id: 'l1', courseCode: 'EBC-MAN', courseName: 'Management', date: '20260420' }] }))).toBe(true);
    });

    it('is hidden when the course is hidden with a matching type (seminar)', () => {
        const l = lesson({ courseCode: 'EBC-MAN', isSeminar: 'true' });
        expect(isLessonHidden(l, hidden({ courses: [{ courseCode: 'EBC-MAN', courseName: 'Management', type: 'seminar' }] }))).toBe(true);
    });

    it('is hidden when the course is hidden with a matching type (lecture)', () => {
        const l = lesson({ courseCode: 'EBC-MAN', isSeminar: 'false' });
        expect(isLessonHidden(l, hidden({ courses: [{ courseCode: 'EBC-MAN', courseName: 'Management', type: 'lecture' }] }))).toBe(true);
    });

    it('is hidden when the course is hidden with type "all", regardless of lesson type', () => {
        const l = lesson({ courseCode: 'EBC-MAN', isSeminar: 'true' });
        expect(isLessonHidden(l, hidden({ courses: [{ courseCode: 'EBC-MAN', courseName: 'Management', type: 'all' }] }))).toBe(true);
    });

    it('is NOT hidden when the course entry type differs from the lesson type', () => {
        const l = lesson({ courseCode: 'EBC-MAN', isSeminar: 'true' }); // seminar lesson
        expect(isLessonHidden(l, hidden({ courses: [{ courseCode: 'EBC-MAN', courseName: 'Management', type: 'lecture' }] }))).toBe(false);
    });

    it('is NOT hidden when the course code does not match', () => {
        const l = lesson({ courseCode: 'EBC-MAN' });
        expect(isLessonHidden(l, hidden({ courses: [{ courseCode: 'OTHER-CODE', courseName: 'Other', type: 'all' }] }))).toBe(false);
    });
});
