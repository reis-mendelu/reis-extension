export type AppView = 'calendar' | 'exams' | 'settings' | 'timeline-demo';

export interface SelectedSubject {
    courseCode: string;
    courseName: string;
    courseId: string;
    id: string;
    isFromSearch?: boolean;
}
