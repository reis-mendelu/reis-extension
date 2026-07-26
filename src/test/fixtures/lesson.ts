import type { BlockLesson } from '../../types/calendarTypes';

/**
 * A minimal valid BlockLesson for tests. Defaults to Monday 2026-04-20,
 * 09:00–10:50 in Q01; override whatever the test cares about.
 */
export function makeLesson(over: Partial<BlockLesson> = {}): BlockLesson {
    return {
        id: 'l1',
        date: '20260420',
        startTime: '09:00',
        endTime: '10:50',
        courseName: 'Management',
        courseCode: 'EBC-MAN',
        courseId: '1',
        room: 'Q01',
        roomStructured: {} as BlockLesson['roomStructured'],
        teachers: [],
        periodId: '',
        studyId: '',
        campus: '',
        isDefaultCampus: '',
        facultyCode: '',
        isSeminar: 'false',
        isConsultation: 'false',
        ...over,
    };
}
