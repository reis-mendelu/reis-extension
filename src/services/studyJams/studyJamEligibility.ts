import { IndexedDBService } from '../storage';
import { getUserParams } from '../../utils/userParams';
import type { GradeHistory, SubjectsData } from '../../types/documents';

export interface StudyJamSuggestion {
    courseCode: string;
    courseName: string;
    role: 'tutor' | 'tutee';
}

function parsePeriodScore(period: string): number {
    const match = period.match(/^(ZS|LS)\s+(\d{4})\/\d{4}/);
    if (!match) return 0;
    const isLS = match[1] === 'LS';
    const year = parseInt(match[2], 10);
    return year * 2 + (isLS ? 1 : 0);
}

export async function checkStudyJamEligibility(
    killerCourses: { course_code: string; course_name: string }[],
): Promise<StudyJamSuggestion[]> {
    console.debug('[StudyJamEligibility] killer courses:', killerCourses.map(kc => kc.course_code));
    if (killerCourses.length === 0) return [];

    const userParams = await getUserParams();
    console.debug('[StudyJamEligibility] userParams:', { studySemester: userParams?.studySemester, studyYear: userParams?.studyYear, studentId: userParams?.studentId });
    if (!userParams) return [];

    const killerMap = new Map(killerCourses.map(kc => [kc.course_code, kc.course_name]));
    const suggestions: StudyJamSuggestion[] = [];
    const suggested = new Set<string>();

    // --- Tutor check: A/B grade in last 2 semesters ---
    const gradeHistory = await IndexedDBService.get('grade_history', 'all') as GradeHistory | null;
    console.debug('[StudyJamEligibility] gradeHistory grades count:', gradeHistory?.grades?.length ?? 0);
    if (gradeHistory?.grades?.length) {
        const top2Scores = [...new Set(gradeHistory.grades.map(g => parsePeriodScore(g.period)))]
            .sort((a, b) => b - a).slice(0, 2);
        for (const grade of gradeHistory.grades) {
            if (!top2Scores.includes(parsePeriodScore(grade.period))) continue;
            if (!['A', 'B'].includes(grade.gradeLetter)) continue;
            if (!grade.courseCode) continue;
            const courseName = killerMap.get(grade.courseCode);
            if (!courseName) continue;
            if (suggested.has(grade.courseCode)) continue;
            suggested.add(grade.courseCode);
            suggestions.push({ courseCode: grade.courseCode, courseName, role: 'tutor' });
        }
    }

    // --- Tutee check: enrolled in killer course, studySemester <= 2 ---
    console.debug('[StudyJamEligibility] tutee gate: studySemester =', userParams.studySemester, '-> passes?', (userParams.studySemester ?? 99) <= 2);
    if ((userParams.studySemester ?? 99) <= 2) {
        const subjectsData = await IndexedDBService.get('subjects', 'current') as SubjectsData | null;
        const enrolledCodes = subjectsData?.data ? Object.keys(subjectsData.data) : [];
        const enrolledKillerCourses = enrolledCodes.filter(c => killerMap.has(c));
        console.debug('[StudyJamEligibility] enrolled subject codes:', enrolledCodes);
        console.debug('[StudyJamEligibility] killer codes:', [...killerMap.keys()]);
        console.debug('[StudyJamEligibility] enrolled killer courses:', enrolledKillerCourses);
        if (subjectsData?.data) {
            for (const code of Object.keys(subjectsData.data)) {
                const courseName = killerMap.get(code);
                if (!courseName) continue;
                if (suggested.has(code)) continue;
                suggested.add(code);
                suggestions.push({ courseCode: code, courseName, role: 'tutee' });
            }
        }
    }

    console.debug('[StudyJamEligibility] pre-filter eligibility:', suggestions);
    return suggestions;
}
