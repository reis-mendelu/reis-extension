export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo' | 'subjects' | 'erasmus';

export interface SelectedSubject {
    courseCode: string;
    courseName: string;
    courseId: string;
    id: string;
    isFromSearch?: boolean;
    facultyCode?: string;
    initialTab?: 'files' | 'stats' | 'assessments' | 'syllabus' | 'classmates';
}
