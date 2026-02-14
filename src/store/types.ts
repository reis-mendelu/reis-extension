import type { StateCreator } from 'zustand';
import type { BlockLesson } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SyllabusRequirements, ParsedFile, Assessment, SubjectsData, SubjectSuccessRate } from '../types/documents';
import type { SyncStatus } from '../services/sync';

export type Status = 'idle' | 'loading' | 'success' | 'error';
export type Theme = "mendelu" | "mendelu-dark";
export type Language = "cz" | "en";

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
    fetchAllFiles: () => Promise<void>;
    refreshFiles: (courseCode: string) => Promise<void>;
}

export interface AssessmentsSlice {
    assessments: Record<string, Assessment[]>;
    assessmentsLoading: Record<string, boolean>;
    fetchAssessments: (courseCode: string) => Promise<void>;
}

export interface SubjectsSlice {
    subjects: SubjectsData | null;
    subjectsLoading: boolean;
    fetchSubjects: () => Promise<void>;
}

export interface SyncSlice {
    syncStatus: SyncStatus;
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

export interface UseThemeResult {
  theme: Theme;
  isDark: boolean;
  isLoading: boolean;
  toggle: () => void;
  setTheme: (theme: Theme) => void;
}

export type AppState = ScheduleSlice & ExamSlice & SyllabusSlice & FilesSlice & AssessmentsSlice & SubjectsSlice & SyncSlice & ThemeSlice & I18nSlice & SuccessRateSlice;

export type AppSlice<T> = StateCreator<AppState, [], [], T>;
