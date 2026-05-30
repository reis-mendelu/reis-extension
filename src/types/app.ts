export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo' | 'subjects' | 'studyPlan' | 'erasmus' | 'iskam-dashboard';

export interface SelectedSubject {
    courseCode: string;
    courseName: string;
    courseId: string;
    id: string;
    isFromSearch?: boolean;
    facultyCode?: string;
    initialTab?: 'files' | 'stats' | 'syllabus' | 'classmates' | 'zaznamnik';
    isFulfilled?: boolean;
}
