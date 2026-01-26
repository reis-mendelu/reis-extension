import type { ExamSubject, ExamSection } from '../../../types/exams';

export function updateExamOptimistically(current: ExamSubject[], sid: string, up: Partial<ExamSection>): ExamSubject[] {
    return current.map(s => ({ ...s, sections: s.sections.map(sec => sec.id === sid ? { ...sec, ...up } : sec) }));
}
