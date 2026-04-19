import type { StateCreator } from 'zustand';
import type { BlockLesson, HiddenItems, CalendarCustomEvent } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SyllabusRequirements, ParsedFile, Assessment, SubjectsData, SubjectSuccessRate, SubjectAttendance } from '../types/documents';
import type { ClassmatesData, Classmate } from '../types/classmates';
import type { DualLanguageStudyPlan, StudyStats } from '../types/studyPlan';
import type { CvicnyTest } from '../api/cvicneTests';
import type { Odevzdavarna } from '../api/odevzdavarny';
import type { SyncStatus } from '../services/sync';
import type { ErasmusCountryData, ErasmusConfig, University } from '../types/erasmus';
import type { AIComparisonResult } from '../api/gemini';
import type { PinnedPage } from './slices/createPinnedPagesSlice';
import type { OutletMenu } from '../types/menuTypes';
import type { PageCategory } from '../data/pages/types';
import type { SpolekNotification } from '../services/spolky/types';

export type Status = 'idle' | 'loading' | 'success' | 'error';
export type Theme = "mendelu" | "mendelu-dark";
export type Language = "cz" | "en";

export interface CourseDeadline {
    week: number;
    label: string;
}

export interface ScheduleSlice {
  schedule: {
    data: BlockLesson[];
    status: Status;
    weekStart: Date | null;
  };
  fetchSchedule: () => Promise<void>;
  setSchedule: (data: BlockLesson[]) => void;
}

export interface ExamSlice {
  exams: {
    data: ExamSubject[];
    status: Status;
    error: string | null;
  };
  fetchExams: () => Promise<void>;
  setExams: (data: ExamSubject[]) => void;
  examClassmates: Record<string, Classmate[]>;
  loadExamClassmates: (terminId: string, studiumId: string, obdobiId: string) => Promise<void>;
}

export interface SyllabusSlice {
  syllabuses: {
    cache: Record<string, SyllabusRequirements>;
    loading: Record<string, boolean>;
  };
  fetchSyllabus: (courseCode: string, courseId?: string, subjectName?: string) => Promise<void>;
}



export interface FilesSlice {
    files: Record<string, ParsedFile[]>;
    filesLoading: Record<string, boolean>;
    fetchFiles: (courseCode: string) => Promise<void>;
    fetchFilesPriority: (courseCode: string) => Promise<void>;
    fetchAllFiles: () => Promise<void>;
    refreshFiles: (courseCode: string) => Promise<void>;
}

export interface AssessmentsSlice {
    assessments: Record<string, Assessment[]>;
    assessmentsLoading: Record<string, boolean>;
    fetchAssessments: (courseCode: string) => Promise<void>;
}

export interface ClassmatesSlice {
    /** courseCode → flat list of seminar classmates */
    classmates: Record<string, ClassmatesData>;
    classmatesLoading: Record<string, boolean>;
    fetchClassmates: (courseCode: string) => Promise<void>;
    invalidateClassmates: () => void;
}

export interface SubjectsSlice {
    subjects: SubjectsData | null;
    subjectsLoading: boolean;
    courseNicknames: Record<string, string>;
    courseDeadlines: Record<string, CourseDeadline[]>;
    attendance: Record<string, SubjectAttendance[]>;
    fetchSubjects: () => Promise<void>;
    setAttendance: (data: Record<string, SubjectAttendance[]>) => void;
    setCourseNickname: (courseCode: string, nickname: string | null) => void;
    setCourseDeadlines: (courseCode: string, deadlines: CourseDeadline[] | null) => void;
}

export interface SyncSlice {
    syncStatus: SyncStatus;
    isSyncing: boolean;
    fetchSyncStatus: () => Promise<void>;
    setSyncStatus: (status: Partial<SyncStatus>) => void;
}

export interface ThemeSlice {
    theme: Theme;
    isThemeLoading: boolean;
    setTheme: (theme: Theme) => Promise<void>;
    loadTheme: () => Promise<void>;
}

export interface I18nSlice {
    language: Language;
    isLanguageLoading: boolean;
    setLanguage: (lang: Language) => Promise<void>;
    loadLanguage: () => Promise<void>;
}

export interface SuccessRateSlice {
    successRates: Record<string, SubjectSuccessRate>;
    successRatesLoading: Record<string, boolean>;
    successRatesGlobalLoaded: boolean;
    fetchSuccessRate: (courseCode: string) => Promise<void>;
    fetchSuccessRateBatch: (courseCodes: string[]) => Promise<void>;
}

export interface StudyJamSuggestion {
    courseCode: string;
    courseName: string;
    role: 'tutor' | 'tutee';
}

export interface StudyJamsSlice {
    isStudyJamOpen: boolean;
    setIsStudyJamOpen: (isOpen: boolean) => void;
    isSelectingTime: boolean;
    setIsSelectingTime: (isSelecting: boolean) => void;
    pendingTimeSelection: { dayIndex: number; startMins: number; endMins: number; formattedTime: string } | null;
    setPendingTimeSelection: (selection: { dayIndex: number; startMins: number; endMins: number; formattedTime: string } | null) => void;
    studyJamSuggestions: StudyJamSuggestion[];
    studyJamOptIns: Record<string, { role: 'tutor' | 'tutee' }>;
    studyJamMatch: { courseCode: string; courseName: string; otherPartyStudentId: string; myRole: 'tutor' | 'tutee'; resolvedName?: string; teamsHandle?: string; } | null;
    studyJamDismissals: Record<string, boolean>;
    selectedStudyJamSuggestion: StudyJamSuggestion | null;
    setSelectedStudyJamSuggestion: (suggestion: StudyJamSuggestion | null) => void;
    loadStudyJamSuggestions: () => Promise<void>;
    optInStudyJam: (courseCode: string, courseName: string, role: 'tutor' | 'tutee') => Promise<void>;
    dismissStudyJamSuggestion: (courseCode: string) => Promise<void>;
    cancelOptIn: (courseCode: string) => Promise<void>;
    hideStudyJamMatch: () => void;
    withdrawStudyJamMatch: () => Promise<void>;
}

export interface FeedbackSlice {
    feedbackEligible: boolean;
    feedbackDismissed: boolean;
    loadFeedbackState: () => Promise<void>;
    submitNps: (rating: number) => Promise<void>;
    dismissFeedback: () => Promise<void>;
}

export interface StudyPlanSlice {
    studyPlanDual: DualLanguageStudyPlan | null;
    /** true once the first fetchStudyPlan() call has fully resolved */
    studyPlanLoaded: boolean;
    studyStats: StudyStats | null;
    fetchStudyPlan: () => Promise<void>;
    fetchStudyStats: () => Promise<void>;
}

export interface ErasmusStudentInfo {
    firstName: string;
    lastName: string;
    dob: string;
    studyCode: string;
    semester: 'WS' | 'SS' | '';
    studentId: string;
}

export interface ErasmusUniversityOption {
    id: string;
    institutionName: string;
    erasmusCode: string;
    country: string;
    link: string;
    courses: { code: string; name: string; credits: number }[];
}

export interface ErasmusSlice {
    erasmusData: ErasmusCountryData | null;
    erasmusLoading: boolean;
    erasmusCountryFile: string;
    erasmusConfig: ErasmusConfig | null;
    erasmusTableBCourses: Record<string, string[]>;
    erasmusStudentInfo: ErasmusStudentInfo;
    erasmusTableAOptions: ErasmusUniversityOption[];
    erasmusVerdicts: Record<string, 'approved' | 'rejected'>;
    erasmusAiResults: Record<string, AIComparisonResult>;
    erasmusPdfAssignments: Record<string, string>; // courseCode → filename
    erasmusPinnedUniversities: string[];
    erasmusUploadedPdfs: Record<string, { text: string; base64: string }>; // filename → extracted text + raw base64
    erasmusActiveTab: 'plan' | 'explore';
    erasmusPlanPhase: 'select' | 'review';
    universities: Record<string, University[]>;
    universitiesLoading: Record<string, boolean>;
    fetchUniversities: (alpha2: string) => Promise<void>;
    addErasmusUploadedPdf: (filename: string, text: string, base64: string) => void;
    removeErasmusUploadedPdf: (filename: string) => void;
    clearErasmusUploadedPdfs: () => void;
    setErasmusPdfAssignment: (courseCode: string, filename: string | null) => void;
    setErasmusCountry: (file: string) => Promise<void>;
    setErasmusActiveTab: (tab: 'plan' | 'explore') => void;
    setErasmusPlanPhase: (phase: 'select' | 'review') => void;
    fetchErasmusReports: () => Promise<void>;
    fetchErasmusConfig: () => Promise<void>;
    toggleErasmusTableBCourse: (optionId: string, code: string) => void;
    reorderErasmusTableBCourse: (optionId: string, fromIndex: number, toIndex: number) => void;
    setErasmusStudentInfo: (data: Partial<ErasmusStudentInfo>) => void;
    initErasmusStudentInfo: (params: { fullName?: string; studyProgram?: string; studentId?: string }) => void;
    setErasmusVerdict: (code: string, verdict: 'approved' | 'rejected' | null) => void;
    setErasmusAiResult: (code: string, result: AIComparisonResult | null) => void;
    pinErasmusUniversity: (name: string) => void;
    unpinErasmusUniversity: (name: string) => void;
    addErasmusTableAOption: () => void;
    removeErasmusTableAOption: (id: string) => void;
    updateErasmusTableAOptionHeader: (id: string, data: Partial<Omit<ErasmusUniversityOption, 'id' | 'courses'>>) => void;
    addErasmusTableACourse: (optionId: string, course: { code: string; name: string; credits: number }) => void;
    removeErasmusTableACourse: (optionId: string, index: number) => void;
    reorderErasmusTableACourse: (optionId: string, fromIndex: number, toIndex: number) => void;
    loadErasmusState: () => Promise<void>;
}

export interface CvicneTestsSlice {
    cvicneTests: CvicnyTest[];
    cvicneTestsStatus: Status;
    fetchCvicneTests: () => Promise<void>;
    setCvicneTests: (tests: CvicnyTest[]) => void;
    odevzdavarny: Odevzdavarna[];
    odevzdavarnyStatus: Status;
    fetchOdevzdavarny: () => Promise<void>;
    setOdevzdavarny: (assignments: Odevzdavarna[]) => void;
}


export interface UseThemeResult {
  theme: Theme;
  isDark: boolean;
  isLoading: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export interface PinnedPagesSlice {
  pinnedPages: PinnedPage[];
  loadPinnedPages: () => Promise<void>;
  pinPage: (page: PinnedPage) => Promise<void>;
  unpinPage: (id: string) => Promise<void>;
  migratePinnedIds: (navPages: PageCategory[]) => Promise<void>;
}

export interface MenuSlice {
  menu: OutletMenu[] | null;
  menuLoading: boolean;
  menuError: boolean;
  fetchMenu: () => Promise<void>;
}

export interface HiddenItemsSlice {
  hiddenItems: HiddenItems;
  loadHiddenItems: () => Promise<void>;
  hideCourse: (courseCode: string, courseName: string, type?: 'lecture' | 'seminar' | 'all') => Promise<void>;
  unhideCourse: (courseCode: string, type?: 'lecture' | 'seminar' | 'all') => Promise<void>;
  hideEvent: (id: string, courseCode: string, courseName: string, date: string) => Promise<void>;
  unhideEvent: (id: string) => Promise<void>;
}

export interface TeachingWeekSlice {
    teachingWeekData: { weeks: { week: number; from: string; to: string }[]; total: number } | null;
    fetchTeachingWeek: () => Promise<void>;
}

export interface NavPagesSlice {
    navPages: PageCategory[] | null;
    setNavPages: (pages: PageCategory[]) => void;
}

export interface ContextSlice {
    studiumId: string | null;
    studentId: string | null;
    obdobiId: string | null;
    facultyId: string | null;
    userFaculty: string | null;
    userSemester: string | null;
    isErasmus: boolean;
    fullName: string | null;
    loadContext: () => Promise<void>;
}

export interface CalendarCustomEventsSlice {
  customEvents: CalendarCustomEvent[];
  loadCalendarCustomEvents: () => Promise<void>;
  addCalendarCustomEvent: (event: CalendarCustomEvent) => Promise<void>;
  updateCalendarCustomEvent: (id: string, patch: Partial<CalendarCustomEvent>) => Promise<void>;
  removeCalendarCustomEvent: (id: string) => Promise<void>;
}

export interface PulseSlice {
    now: Date;
    updatePulse: () => void;
}

export interface NotificationSlice {
    notifications: {
        data: SpolekNotification[];
        readIds: Set<string>;
        viewedIds: Set<string>;
        seenDeadlineAlertIds: Set<string>;
        status: Status;
    };
    fetchNotifications: () => Promise<void>;
    markNotificationsRead: (ids: string[]) => Promise<void>;
    markNotificationViewed: (id: string) => Promise<void>;
    markDeadlineAlertsSeen: (ids: string[]) => Promise<void>;
    loadNotificationState: () => Promise<void>;
}

export type AppState = ScheduleSlice & ExamSlice & SyllabusSlice & FilesSlice & AssessmentsSlice & ClassmatesSlice & SubjectsSlice & SyncSlice & ThemeSlice & I18nSlice & SuccessRateSlice & StudyJamsSlice & FeedbackSlice & StudyPlanSlice & CvicneTestsSlice & ErasmusSlice & PinnedPagesSlice & MenuSlice & HiddenItemsSlice & CalendarCustomEventsSlice & TeachingWeekSlice & NavPagesSlice & ContextSlice & PulseSlice & NotificationSlice;


export type AppSlice<T> = StateCreator<AppState, [], [], T>;
