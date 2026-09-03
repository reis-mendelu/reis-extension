import type { ParsedSyllabus } from '../schemas/syllabusSchema';

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
    hasPrubezne?: boolean;
    hasTest?: boolean;
    autoHref?: string | null;
}

export interface SubjectsData {
    version: number;
    lastUpdated: string;
    data: Record<string, SubjectInfo>;
}

export type AttendanceStatus = 'present' | 'absent' | 'excused' | 'late' | 'early-leave' | 'excluded' | 'elsewhere';

export interface AttendanceRecord {
    date: string;
    time: string;
    room: string;
    status: AttendanceStatus;
}

export interface SubjectAttendance {
    label: string;
    records: AttendanceRecord[];
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
    /** IS `predmet` id from reis-data (e.g. "160301"). Present in the CDN JSON; used to
     * open not-enrolled study-plan subjects directly in the SubjectDrawer. May be a stale
     * (older-semester) instance or, rarely, junk — always validate before use. */
    predmetId?: string;
}

export interface SuccessRateData {
    lastUpdated: string; // Global sync timestamp
    data: Record<string, SubjectSuccessRate>; // Keyed by course code
}

export interface CourseMetadata {
    courseName?: string | null;  // Deprecated: Use courseNameCs/courseNameEn
    courseNameCs?: string | null;  // Czech course name
    courseNameEn?: string | null;  // English course name
    courseCode?: string | null;   // Short course code (e.g. "DSND")
    credits: string | null;
    garant?: { name: string | null; id?: string | null } | null;
    teachers: { name: string; id?: string | null; roles: string }[];
    status: string | null;
}

export interface AvailablePeriod {
    id: string;    // e.g. "801"
    label: string; // e.g. "ZS 2025/2026 - PEF"
}

export interface CourseGrade {
    period: string;        // "ZS 2025/2026 - PEF"
    predmetId: string;     // "159410"
    courseCode?: string;   // "DSND" — short code from second table cell
    courseName: string;    // "Algoritmizace"
    courseNameEn?: string; // English name from EN parallel fetch
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

export interface DocumentNote {
    note: string;
    updatedAt: number;
    /** Display name of the IS file, kept so orphaned notes keep their heading in the Drive Doc. */
    fileName?: string;
}

export interface NoteImage {
    hash: string;       // SHA-256 hex — the IDB key
    blob: Blob;         // normalized JPEG bytes
    mime: string;       // 'image/jpeg'
    w: number;
    h: number;
    createdAt: number;  // epoch ms — drives the GC grace-period exemption
}

/**
 * A syllabus as it is STORED: in IndexedDB and in the Zustand cache. Derived
 * from `ParsedSyllabus` so a field added to the parse schema cannot go missing
 * here — the two shapes were hand-maintained copies and drifted (see
 * SYLLABUS_VERSION in utils/parsers/syllabusParser.ts for the same failure one
 * level up).
 *
 * The two fields it adds are exactly the two `src/types/schemas/syllabus.schema.ts`
 * declares on top of the parse schema, and for the same reasons:
 *  - `language` is stamped by api/syllabus.ts AFTER parsing (the parse schema
 *    omits it, and Zod strips it), and is what `createSyllabusSlice` branches
 *    on for a legacy single-language record.
 *  - `version` is widened back to optional `number` — NOT the parser's literal
 *    union — because records written before versioning still sit on disk, and
 *    that store validator is fail-open by design ("must never reject genuine
 *    data"). Narrowing it here would be a claim about disk contents nothing
 *    validates. Anything produced now comes through `ParsedSyllabus`, where
 *    `version` is required.
 */
export interface SyllabusRequirements extends Omit<ParsedSyllabus, 'version'> {
    version?: number;
    language?: string;
}
