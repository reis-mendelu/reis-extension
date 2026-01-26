import type { StateCreator } from 'zustand';
import type { BlockLesson } from '../types/calendarTypes';
import type { ExamSubject } from '../types/exams';
import type { SyllabusRequirements } from '../types/documents';

export type Status = 'idle' | 'loading' | 'success' | 'error';

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

export type AppState = ScheduleSlice & ExamSlice & SyllabusSlice;

export type AppSlice<T> = StateCreator<AppState, [], [], T>;
