export interface CalendarSubject {
    day: string;
    date: string;
    startTime: string;
    endTime: string;
    subject: string;
    subjectCode: string;
    faculty: string;
    type: string;
    room: string;
    teacher: string;
}

export interface Teacher {
    fullName: string;
    shortName: string;
    id: string,
}

export interface RoomStructured {
    name: string;
    id: string;
}

export interface BlockLesson {
    id: string;
    date: string; // YYYYMMDD format, e.g., "20251022"
    startTime: string; // HH:MM format, e.g., "15:00"
    endTime: string; // HH:MM format, e.g., "16:50"
    courseName: string;
    courseCode: string;
    courseId: string;
    sectionName?: string;
    room: string;
    roomStructured: RoomStructured;
    teachers: Teacher[];
    periodId: string;
    studyId: string;
    campus: string;
    isDefaultCampus: string;
    facultyCode: string;
    isSeminar: string; // 'true' or 'false' as string
    isConsultation: string; // 'true' or 'false' as string
    isExam?: boolean;
    examEvent?: any;
    isFromSearch?: boolean; // Indicates drawer opened from search (not a calendar event)
    // Dual-language support
    courseNameCs?: string;
    courseNameEn?: string;
    roomCs?: string;
    roomEn?: string;
}

export interface FileObject {
    subfolder: string;
    file_name: string;
    file_comment: string;
    author: string;
    date: string;
    files: {
        name: string;
        type: string;
        link: string;
    }[];
}

export interface StoredSubject {
    fullName: string;
    folderUrl: string;
    // Add other properties if needed based on usage
}

export interface ScheduleData {
    blockLessons: BlockLesson[];
}

export interface LessonWithRow extends BlockLesson {
    row: number;
    maxColumns: number;
}

export interface OrganizedLessons {
    lessons: LessonWithRow[];
    totalRows: number;
}

export interface DateInfo {
    weekday: string;
    day: string;
    month: string;
    year: string;
    full: string;
}
