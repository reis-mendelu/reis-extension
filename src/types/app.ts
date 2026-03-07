export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo' | 'subjects';

export interface SelectedSubject {
    courseCode: string;
    courseName: string;
    courseId: string;
    id: string;
    isFromSearch?: boolean;
    facultyCode?: string;
}
