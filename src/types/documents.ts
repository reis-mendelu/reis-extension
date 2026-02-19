export interface SubjectInfo {
    displayName: string;
    fullName: string;
    nameCs?: string;
    nameEn?: string;
    subjectCode: string;
    subjectId?: string; // Numeric ID (from predmet=...)
    skupinaId?: string; // Seminar group ID for classmates
    folderUrl: string;
    fetchedAt: string;
}

export interface SubjectsData {
    version: number;
    lastUpdated: string;
    data: Record<string, SubjectInfo>;
}

export interface FileAttachment {
    name: string;
    type: string;
    link: string;
}

export interface ParsedFile {
    subfolder: string;
    file_name: string;
    file_comment: string;
    author: string;
    date: string;
    files: FileAttachment[];
    language?: string; // Language of the fetch request
}

export interface GradeStats {
    A: number; B: number; C: number; D: number; E: number; F: number; FN: number;
}

export interface CreditStats {
    zap: number;
    nezap: number;
    zapNedost: number;
}

export interface TermStats {
    term: string;
    grades: GradeStats;
    creditGrades?: CreditStats;
    pass: number;
    fail: number;
}

export interface SemesterStats {
    semesterName: string; 
    semesterId: string;
    year: number;
    totalPass: number;
    totalFail: number;
    sourceUrl?: string; // Original IS MENDELU URL
    type: 'exam' | 'credit';
    terms: TermStats[];
}

export interface SubjectSuccessRate {
    courseCode: string;
    stats: SemesterStats[];
    lastUpdated: string;
}

export interface SuccessRateData {
    lastUpdated: string; // Global sync timestamp
    data: Record<string, SubjectSuccessRate>; // Keyed by course code
}

export interface CourseMetadata {
    courseName?: string | null;  // Deprecated: Use courseNameCs/courseNameEn
    courseNameCs?: string | null;  // Czech course name
    courseNameEn?: string | null;  // English course name
    credits: string | null;
    garant: { name: string | null; id?: string | null } | null;
    teachers: { name: string; id?: string | null; roles: string }[];
    status: string | null;
}

export interface Assessment {
    name: string;
    score: number;
    maxScore: number;
    successRate: number;
    submittedDate: string;
    teacher: string;
    detailUrl?: string; // Relative URL for details
}

export interface CourseGrade {
    period: string;        // "ZS 2025/2026 - PEF"
    predmetId: string;     // "159410"
    courseName: string;    // "Algoritmizace"
    examType: string;      // "zk" | "záp" | "zak"
    attempt: number | null;
    gradeText: string;     // "dobře plus (D)"
    gradeLetter: string;   // "D" — empty if not yet graded
    credits: number | null;
}

export interface GradeHistory {
    studium: string;
    fetchedAt: string;
    grades: CourseGrade[];
}

export interface SyllabusRequirements {
    version?: number;
    language?: string; // New: Origin language of the parsed syllabus
    courseId?: string; // Resolved IS Subject ID
    requirementsText: string; // Textual description of requirements
    requirementsTable: string[][]; // Grading breakdown table (rows of cells)
    courseInfo?: CourseMetadata; // New: General course info (credits, garant, etc.)
    assessmentMethods?: string | null;
    assessmentCriteria?: {
        requirementType: string;
        dailyAttendance: string;
        combinedForm: string;
    }[];
}
