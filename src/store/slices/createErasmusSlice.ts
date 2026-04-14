import type { ErasmusSlice, AppSlice, ErasmusUniversityOption, ErasmusStudentInfo } from '../types';
import { fetchErasmusReports, getStoredErasmusData, fetchErasmusConfig as fetchErasmusConfigApi } from '../../api/erasmus';
import { IndexedDBService } from '../../services/storage';
import { loggers } from '../../utils/logger';

const TABLE_A_COURSES_KEY = 'erasmus_table_a_courses'; // Legacy
const TABLE_A_OPTIONS_KEY = 'erasmus_table_a_options';
const TABLE_B_COURSES_KEY = 'erasmus_table_b_courses';
const STUDENT_INFO_KEY = 'erasmus_student_info';
const ERASMUS_UI_STATE_KEY = 'erasmus_ui_state';
const VERDICTS_KEY = 'erasmus_verdicts';
const PDF_ASSIGNMENTS_KEY = 'erasmus_pdf_assignments';
const PINNED_UNIVERSITIES_KEY = 'erasmus_pinned_universities';
const UPLOADED_PDFS_KEY = 'erasmus_uploaded_pdfs';
const MAX_PINNED = 4;

const EMPTY_STUDENT_INFO: ErasmusStudentInfo = {
  firstName: '', lastName: '', dob: '', studyCode: '', semester: '', studentId: '',
};

export const createErasmusSlice: AppSlice<ErasmusSlice> = (set, get) => ({
  erasmusData: null,
  erasmusLoading: false,
  erasmusCountryFile: '',
  erasmusConfig: null,
  erasmusTableBCourses: {},
  erasmusStudentInfo: { ...EMPTY_STUDENT_INFO },
  erasmusTableAOptions: [
    { id: 'opt-1', institutionName: '', erasmusCode: '', country: '', link: '', courses: [] }
  ],
  erasmusVerdicts: {},
  erasmusPdfAssignments: {},
  erasmusPinnedUniversities: [],
  erasmusUploadedPdfs: {},
  erasmusActiveTab: 'plan',
  erasmusPlanPhase: 'select',
  setErasmusActiveTab: (tab: 'plan' | 'explore') => {
    set({ erasmusActiveTab: tab });
    IndexedDBService.set('meta', ERASMUS_UI_STATE_KEY, { 
      activeTab: tab, 
      planPhase: get().erasmusPlanPhase 
    }).catch(() => {});
  },
  setErasmusPlanPhase: (phase: 'select' | 'review') => {
    set({ erasmusPlanPhase: phase });
    IndexedDBService.set('meta', ERASMUS_UI_STATE_KEY, { 
      activeTab: get().erasmusActiveTab, 
      planPhase: phase 
    }).catch(() => {});
  },
  setErasmusCountry: async (file: string) => {
    if (get().erasmusCountryFile !== file || !get().erasmusData) {
      set({ erasmusCountryFile: file, erasmusLoading: true });
    } else {
      set({ erasmusCountryFile: file });
    }
    try {
      const cached = await getStoredErasmusData(file);
      if (cached) set({ erasmusData: cached });

      const data = await fetchErasmusReports(file);
      if (data) set({ erasmusData: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] Fetch failed:', err);
    } finally {
      set({ erasmusLoading: false });
    }
  },
  fetchErasmusConfig: async () => {
    try {
      const data = await fetchErasmusConfigApi();
      if (data) set({ erasmusConfig: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] Config fetch failed:', err);
    }
  },
  fetchErasmusReports: async () => {
    const file = get().erasmusCountryFile;
    if (!file) return;
    if (!get().erasmusData) set({ erasmusLoading: true });
    try {
      const cached = await getStoredErasmusData(file);
      if (cached) set({ erasmusData: cached });

      const data = await fetchErasmusReports(file);
      if (data) set({ erasmusData: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] Fetch failed:', err);
    } finally {
      set({ erasmusLoading: false });
    }
  },
  reorderErasmusTableBCourse: (optionId: string, fromIndex: number, toIndex: number) => {
    const all = get().erasmusTableBCourses;
    const current = [...(all[optionId] ?? [])];
    const [moved] = current.splice(fromIndex, 1);
    current.splice(toIndex, 0, moved);
    const next = { ...all, [optionId]: current };
    set({ erasmusTableBCourses: next });
    IndexedDBService.set('meta', TABLE_B_COURSES_KEY, next).catch(() => {});
  },
  toggleErasmusTableBCourse: (optionId: string, code: string) => {
    const all = get().erasmusTableBCourses;
    const current = all[optionId] ?? [];
    const isRemoving = current.includes(code);
    const next = { ...all, [optionId]: isRemoving ? current.filter(c => c !== code) : [...current, code] };
    set({ erasmusTableBCourses: next });
    IndexedDBService.set('meta', TABLE_B_COURSES_KEY, next).catch(() => {});
    if (isRemoving) {
      const verdicts = { ...get().erasmusVerdicts };
      delete verdicts[code];
      set({ erasmusVerdicts: verdicts });
      IndexedDBService.set('meta', VERDICTS_KEY, verdicts).catch(() => {});
    }
  },
  setErasmusStudentInfo: (data: Partial<ErasmusStudentInfo>) => {
    const next = { ...get().erasmusStudentInfo, ...data };
    set({ erasmusStudentInfo: next });
    IndexedDBService.set('meta', STUDENT_INFO_KEY, next).catch(() => {});
  },
  initErasmusStudentInfo: (params: { fullName?: string; studyProgram?: string; studentId?: string }) => {
    const current = get().erasmusStudentInfo;
    const allBlank = !current.firstName && !current.lastName && !current.studyCode && !current.studentId;
    if (!allBlank) return;
    const fullName = params.fullName?.trim() ?? '';
    const parts = fullName.split(' ');
    const lastName = parts.length > 1 ? parts[parts.length - 1] : fullName;
    const firstName = parts.length > 1 ? parts.slice(0, -1).join(' ') : '';
    // Extract only the first two dash-separated segments (e.g. "B-OI" from "B-OI-ZBOI")
    const rawProgram = params.studyProgram ?? '';
    const programParts = rawProgram.split('-');
    const studyCode = programParts.length >= 2 ? `${programParts[0]}-${programParts[1]}` : rawProgram;
    const next: ErasmusStudentInfo = {
      ...current,
      firstName,
      lastName,
      studyCode,
      studentId: params.studentId ?? '',
    };
    set({ erasmusStudentInfo: next });
  },
  setErasmusVerdict: (code: string, verdict: 'approved' | 'rejected') => {
    const verdicts = { ...get().erasmusVerdicts, [code]: verdict };
    set({ erasmusVerdicts: verdicts });
    IndexedDBService.set('meta', VERDICTS_KEY, verdicts).catch(() => {});
  },
  setErasmusPdfAssignment: (courseCode: string, filename: string | null) => {
    const assignments = { ...get().erasmusPdfAssignments };
    if (filename === null) delete assignments[courseCode];
    else assignments[courseCode] = filename;
    set({ erasmusPdfAssignments: assignments });
    IndexedDBService.set('meta', PDF_ASSIGNMENTS_KEY, assignments).catch(() => {});
  },
  pinErasmusUniversity: (name: string) => {
    const current = get().erasmusPinnedUniversities;
    if (current.includes(name) || current.length >= MAX_PINNED) return;
    const next = [...current, name];
    set({ erasmusPinnedUniversities: next });
    IndexedDBService.set('meta', PINNED_UNIVERSITIES_KEY, next).catch(() => {});
  },
  unpinErasmusUniversity: (name: string) => {
    const next = get().erasmusPinnedUniversities.filter(n => n !== name);
    set({ erasmusPinnedUniversities: next });
    IndexedDBService.set('meta', PINNED_UNIVERSITIES_KEY, next).catch(() => {});
  },
  addErasmusUploadedPdf: (filename: string, text: string, base64: string) => {
    const next = { ...get().erasmusUploadedPdfs, [filename]: { text, base64 } };
    set({ erasmusUploadedPdfs: next });
    IndexedDBService.set('meta', UPLOADED_PDFS_KEY, next).catch(() => {});
  },
  removeErasmusUploadedPdf: (filename: string) => {
    const next = { ...get().erasmusUploadedPdfs };
    delete next[filename];
    set({ erasmusUploadedPdfs: next });
    IndexedDBService.set('meta', UPLOADED_PDFS_KEY, next).catch(() => {});
  },
  clearErasmusUploadedPdfs: () => {
    set({ erasmusUploadedPdfs: {} });
    IndexedDBService.set('meta', UPLOADED_PDFS_KEY, {}).catch(() => {});
  },
  addErasmusTableAOption: () => {
    const current = get().erasmusTableAOptions;
    if (current.length >= 4) return;
    const next = [...current, { 
      id: `opt-${Date.now()}`, 
      institutionName: '', 
      erasmusCode: '', 
      country: '', 
      link: '', 
      courses: [] 
    }];
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(() => {});
  },
  removeErasmusTableAOption: (id: string) => {
    const next = get().erasmusTableAOptions.filter(o => o.id !== id);
    if (next.length === 0) {
      next.push({ id: `opt-${Date.now()}`, institutionName: '', erasmusCode: '', country: '', link: '', courses: [] });
    }
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(() => {});
  },
  updateErasmusTableAOptionHeader: (id, data) => {
    const next = get().erasmusTableAOptions.map(o => o.id === id ? { ...o, ...data } : o);
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(() => {});
  },
  addErasmusTableACourse: (optionId: string, course: { code: string; name: string; credits: number }) => {
    const next = get().erasmusTableAOptions.map(o => o.id === optionId ? { ...o, courses: [...o.courses, course] } : o);
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(() => {});
  },
  removeErasmusTableACourse: (optionId: string, index: number) => {
    const next = get().erasmusTableAOptions.map(o => o.id === optionId ? { ...o, courses: o.courses.filter((_, i) => i !== index) } : o);
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(() => {});
  },
  reorderErasmusTableACourse: (optionId: string, fromIndex: number, toIndex: number) => {
    const next = get().erasmusTableAOptions.map(o => {
      if (o.id !== optionId) return o;
      const courses = [...o.courses];
      const [moved] = courses.splice(fromIndex, 1);
      courses.splice(toIndex, 0, moved);
      return { ...o, courses };
    });
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(() => {});
  },
  loadErasmusState: async () => {
    try {
      const tableBCourses = await IndexedDBService.get('meta', TABLE_B_COURSES_KEY) as Record<string, string[]> | null;
      if (tableBCourses) set({ erasmusTableBCourses: tableBCourses });

      const studentInfo = await IndexedDBService.get('meta', STUDENT_INFO_KEY) as ErasmusStudentInfo | null;
      if (studentInfo) set({ erasmusStudentInfo: { ...EMPTY_STUDENT_INFO, ...studentInfo } });

      const tableAOptions = await IndexedDBService.get('meta', TABLE_A_OPTIONS_KEY) as ErasmusUniversityOption[] | null;
      if (tableAOptions && tableAOptions.length > 0) {
        set({ erasmusTableAOptions: tableAOptions });
      } else {
        const oldTableA = await IndexedDBService.get('meta', TABLE_A_COURSES_KEY) as any[] | null;
        if (oldTableA && oldTableA.length > 0) {
           const initial = [{ id: 'opt-initial', institutionName: '', erasmusCode: '', country: '', link: '', courses: oldTableA }];
           set({ erasmusTableAOptions: initial });
           IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, initial).catch(() => {});
        }
      }

      const verdicts = await IndexedDBService.get('meta', VERDICTS_KEY) as Record<string, 'approved' | 'rejected'> | null;
      if (verdicts) set({ erasmusVerdicts: verdicts });

      const assignments = await IndexedDBService.get('meta', PDF_ASSIGNMENTS_KEY) as Record<string, string> | null;
      if (assignments) set({ erasmusPdfAssignments: assignments });

      const pinned = await IndexedDBService.get('meta', PINNED_UNIVERSITIES_KEY) as string[] | null;
      if (pinned) set({ erasmusPinnedUniversities: pinned });

      const pdfs = await IndexedDBService.get('meta', UPLOADED_PDFS_KEY) as Record<string, { text: string; base64: string }> | null;
      if (pdfs) set({ erasmusUploadedPdfs: pdfs });

      const uiState = await IndexedDBService.get('meta', ERASMUS_UI_STATE_KEY) as { activeTab?: any; planPhase?: any } | null;
      if (uiState) {
        if (uiState.activeTab) set({ erasmusActiveTab: uiState.activeTab });
        if (uiState.planPhase) set({ erasmusPlanPhase: uiState.planPhase });
      }
    } catch { /* ignore */ }
  },
});
