import type { StateCreator } from 'zustand';
import type { BlockLesson, HiddenItems } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SyllabusRequirements, ParsedFile, Assessment, SubjectsData, SubjectSuccessRate, SubjectAttendance } from '../types/documents';
import type { ClassmatesData } from '../types/classmates';
import type { DualLanguageStudyPlan, StudyStats } from '../types/studyPlan';
import type { CvicnyTest } from '../api/cvicneTests';
import type { Odevzdavarna } from '../api/odevzdavarny';
import type { SyncStatus } from '../services/sync';
import type { ErasmusCountryData, ErasmusConfig } from '../types/erasmus';
import type { PinnedPage } from './slices/createPinnedPagesSlice';
import type { OutletMenu } from '../types/menuTypes';
import type { PageCategory } from '../data/pages/types';

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
    isPartial?: boolean;
  };
  fetchSchedule: () => Promise<void>;
  setSchedule: (data: BlockLesson[], isPartial?: boolean) => void;
}

export interface ExamSlice {
  exams: {
    data: ExamSubject[];
    status: Status;
    error: string | null;
  };
  fetchExams: () => Promise<void>;
  setExams: (data: ExamSubject[]) => void;
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
    filesPriorityLoading: Record<string, boolean>;
    filesProgress: Record<string, string>;
    filesTotalCount: Record<string, number>;
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
    studyPlanLoading: boolean;
    /** true once the first fetchStudyPlan() call has fully resolved */
    studyPlanLoaded: boolean;
    studyStats: StudyStats | null;
    fetchStudyPlan: () => Promise<void>;
    fetchStudyStats: () => Promise<void>;
}

export interface ErasmusSlice {
    erasmusData: ErasmusCountryData | null;
    erasmusLoading: boolean;
    erasmusCountryFile: string;
    erasmusConfig: ErasmusConfig | null;
    erasmusSelectedCourses: string[];
    setErasmusCountry: (file: string) => Promise<void>;
    fetchErasmusReports: () => Promise<void>;
    fetchErasmusConfig: () => Promise<void>;
    toggleErasmusCourse: (code: string) => void;
    loadErasmusSelectedCourses: () => Promise<void>;
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

export type AppState = ScheduleSlice & ExamSlice & SyllabusSlice & FilesSlice & AssessmentsSlice & ClassmatesSlice & SubjectsSlice & SyncSlice & ThemeSlice & I18nSlice & SuccessRateSlice & StudyJamsSlice & FeedbackSlice & StudyPlanSlice & CvicneTestsSlice & ErasmusSlice & PinnedPagesSlice & MenuSlice & HiddenItemsSlice & TeachingWeekSlice & NavPagesSlice;

export type AppSlice<T> = StateCreator<AppState, [], [], T>;
