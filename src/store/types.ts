import type { StateCreator } from 'zustand';
import type { BlockLesson } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SyllabusRequirements, ParsedFile, Assessment, SubjectsData, SubjectSuccessRate } from '../types/documents';
import type { ClassmatesData } from '../types/classmates';
import type { DualLanguageStudyPlan } from '../types/studyPlan';
import type { SyncStatus } from '../services/sync';

export type Status = 'idle' | 'loading' | 'success' | 'error';
export type Theme = "mendelu" | "mendelu-dark";
export type Language = "cz" | "en";

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
    classmates: Record<string, ClassmatesData>;
    classmatesAllLoading: Record<string, boolean>;
    classmatesAllProgress: Record<string, string>;
    classmatesSeminarLoading: Record<string, boolean>;
    classmatesSeminarProgress: Record<string, string>;
    fetchClassmatesAll: (courseCode: string) => Promise<void>;
    fetchClassmatesSeminar: (courseCode: string) => Promise<void>;
    invalidateClassmates: () => void;
}

export interface SubjectsSlice {
    subjects: SubjectsData | null;
    subjectsLoading: boolean;
    fetchSubjects: () => Promise<void>;
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
    fetchStudyPlan: () => Promise<void>;
}

export interface UseThemeResult {
  theme: Theme;
  isDark: boolean;
  isLoading: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export type AppState = ScheduleSlice & ExamSlice & SyllabusSlice & FilesSlice & AssessmentsSlice & ClassmatesSlice & SubjectsSlice & SyncSlice & ThemeSlice & I18nSlice & SuccessRateSlice & StudyJamsSlice & FeedbackSlice & StudyPlanSlice;

export type AppSlice<T> = StateCreator<AppState, [], [], T>;
