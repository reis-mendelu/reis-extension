import type { ErasmusSlice, AppSlice, ErasmusUniversityOption, ErasmusStudentInfo } from '../types';
import type { University } from '../../types/erasmus';
import { fetchErasmusReports, getStoredErasmusData, fetchErasmusConfig as fetchErasmusConfigApi } from '../../api/erasmus';
import { fetchJsonViaProxy } from '../../api/proxyClient';
import { IndexedDBService } from '../../services/storage';
import { loggers } from '../../utils/logger';
import { reportError } from '../../utils/reportError';
import type { AIComparisonResult } from '../../api/gemini';

const TABLE_A_COURSES_KEY = 'erasmus_table_a_courses'; // Legacy
const TABLE_A_OPTIONS_KEY = 'erasmus_table_a_options';
const TABLE_B_COURSES_KEY = 'erasmus_table_b_courses';
const STUDENT_INFO_KEY = 'erasmus_student_info';
const ERASMUS_UI_STATE_KEY = 'erasmus_ui_state';
const VERDICTS_KEY = 'erasmus_verdicts';
const AI_RESULTS_KEY = 'erasmus_ai_results';
const PDF_ASSIGNMENTS_KEY = 'erasmus_pdf_assignments';
const PINNED_UNIVERSITIES_KEY = 'erasmus_pinned_universities';
const UPLOADED_PDFS_KEY = 'erasmus_uploaded_pdfs';
const MAX_PINNED = 4;
const UNIVERSITIES_KEY_PREFIX = 'erasmus_universities';
const HEI_API_BASE = 'https://hei.api.uni-foundation.eu/api/public/v1';

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
  erasmusAiResults: {},
  erasmusPdfAssignments: {},
  erasmusPinnedUniversities: [],
  erasmusUploadedPdfs: {},
  erasmusActiveTab: 'plan',
  erasmusPlanPhase: 'select',
  universities: {},
  universitiesLoading: {},
  fetchUniversities: async (alpha2: string) => {
    if (get().universitiesLoading[alpha2]) return;
    set({ universitiesLoading: { ...get().universitiesLoading, [alpha2]: true } });
    try {
      loggers.ui.debug(`[fetchUniversities] start alpha2=${alpha2}`);
      const cached = await IndexedDBService.get('meta', `${UNIVERSITIES_KEY_PREFIX}:${alpha2}`) as University[] | null;
      loggers.ui.debug(`[fetchUniversities] cache result:`, cached?.length ?? 'miss');
      if (cached && cached.length > 0) {
        set({ universities: { ...get().universities, [alpha2]: cached } });
        return;
      }
      const url = `${HEI_API_BASE}/country/${alpha2}/hei`;
      loggers.ui.debug(`[fetchUniversities] fetching via proxy:`, url);
      const json = await fetchJsonViaProxy<any>(url);
      loggers.ui.debug(`[fetchUniversities] response keys:`, Object.keys(json));
      const parsed: University[] = (json.data || []).map((item: any) => {
        const attrs = item.attributes || {};
        const nameObj = attrs.name?.find((n: any) => n.lang === 'en') || attrs.name?.[0];
        const erasmusCode = attrs.other_id?.find((id: any) => id.type === 'erasmus')?.value;
        return {
          name: nameObj?.string || 'Unknown Institution',
          erasmusCode: erasmusCode || '',
          city: attrs.city,
          website: attrs.website_url,
        };
      }).filter((u: University) => u.erasmusCode);
      loggers.ui.debug(`[fetchUniversities] parsed count:`, parsed.length);
      set({ universities: { ...get().universities, [alpha2]: parsed } });
      await IndexedDBService.set('meta', `${UNIVERSITIES_KEY_PREFIX}:${alpha2}`, parsed);
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] fetchUniversities failed:', err);
      console.error('[fetchUniversities] raw error:', err);
    } finally {
      set({ universitiesLoading: { ...get().universitiesLoading, [alpha2]: false } });
    }
  },
  setErasmusActiveTab: (tab: 'plan' | 'explore') => {
    set({ erasmusActiveTab: tab });
    IndexedDBService.set('meta', ERASMUS_UI_STATE_KEY, {
      activeTab: tab,
      planPhase: get().erasmusPlanPhase
    }).catch(e => reportError('ErasmusSlice.setErasmusActiveTab', e));
  },
  setErasmusPlanPhase: (phase: 'select' | 'review') => {
    set({ erasmusPlanPhase: phase });
    IndexedDBService.set('meta', ERASMUS_UI_STATE_KEY, {
      activeTab: get().erasmusActiveTab,
      planPhase: phase
    }).catch(e => reportError('ErasmusSlice.setErasmusPlanPhase', e));
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
    IndexedDBService.set('meta', TABLE_B_COURSES_KEY, next).catch(e => reportError('ErasmusSlice.reorderErasmusTableBCourse', e));
  },
  toggleErasmusTableBCourse: (optionId: string, code: string) => {
    const all = get().erasmusTableBCourses;
    const current = all[optionId] ?? [];
    const isRemoving = current.includes(code);
    const next = { ...all, [optionId]: isRemoving ? current.filter(c => c !== code) : [...current, code] };
    set({ erasmusTableBCourses: next });
    IndexedDBService.set('meta', TABLE_B_COURSES_KEY, next).catch(e => reportError('ErasmusSlice.toggleErasmusTableBCourse', e));
    if (isRemoving) {
      const verdicts = { ...get().erasmusVerdicts };
      delete verdicts[code];
      const aiResults = { ...get().erasmusAiResults };
      delete aiResults[code];
      set({ erasmusVerdicts: verdicts, erasmusAiResults: aiResults });
      IndexedDBService.set('meta', VERDICTS_KEY, verdicts).catch(e => reportError('ErasmusSlice.toggleErasmusTableBCourse:verdicts', e));
      IndexedDBService.set('meta', AI_RESULTS_KEY, aiResults).catch(e => reportError('ErasmusSlice.toggleErasmusTableBCourse:aiResults', e));
    }
  },
  setErasmusStudentInfo: (data: Partial<ErasmusStudentInfo>) => {
    const next = { ...get().erasmusStudentInfo, ...data };
    set({ erasmusStudentInfo: next });
    IndexedDBService.set('meta', STUDENT_INFO_KEY, next).catch(e => reportError('ErasmusSlice.setErasmusStudentInfo', e));
  },
  initErasmusStudentInfo: (params: { fullName?: string; studyProgram?: string; studentId?: string; dob?: string }) => {
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
  setErasmusVerdict: (code: string, verdict: 'approved' | 'rejected' | null) => {
    const verdicts = { ...get().erasmusVerdicts };
    if (verdict === null) delete verdicts[code];
    else verdicts[code] = verdict;
    set({ erasmusVerdicts: verdicts });
    IndexedDBService.set('meta', VERDICTS_KEY, verdicts).catch(e => reportError('ErasmusSlice.setErasmusVerdict', e));
  },
  setErasmusAiResult: (code: string, result: AIComparisonResult | null) => {
    const next = { ...get().erasmusAiResults };
    if (result === null) delete next[code];
    else next[code] = result;
    set({ erasmusAiResults: next });
    IndexedDBService.set('meta', AI_RESULTS_KEY, next).catch(e => reportError('ErasmusSlice.setErasmusAiResult', e));
  },
  setErasmusPdfAssignment: (courseCode: string, filename: string | null) => {
    const assignments = { ...get().erasmusPdfAssignments };
    if (filename === null) delete assignments[courseCode];
    else assignments[courseCode] = filename;
    set({ erasmusPdfAssignments: assignments });
    IndexedDBService.set('meta', PDF_ASSIGNMENTS_KEY, assignments).catch(e => reportError('ErasmusSlice.setErasmusPdfAssignment', e));
  },
  pinErasmusUniversity: (name: string) => {
    const current = get().erasmusPinnedUniversities;
    if (current.includes(name) || current.length >= MAX_PINNED) return;
    const next = [...current, name];
    set({ erasmusPinnedUniversities: next });
    IndexedDBService.set('meta', PINNED_UNIVERSITIES_KEY, next).catch(e => reportError('ErasmusSlice.pinErasmusUniversity', e));
  },
  unpinErasmusUniversity: (name: string) => {
    const next = get().erasmusPinnedUniversities.filter(n => n !== name);
    set({ erasmusPinnedUniversities: next });
    IndexedDBService.set('meta', PINNED_UNIVERSITIES_KEY, next).catch(e => reportError('ErasmusSlice.unpinErasmusUniversity', e));
  },
  addErasmusUploadedPdf: (filename: string, text: string, base64: string) => {
    const next = { ...get().erasmusUploadedPdfs, [filename]: { text, base64 } };
    set({ erasmusUploadedPdfs: next });
    IndexedDBService.set('meta', UPLOADED_PDFS_KEY, next).catch(e => reportError('ErasmusSlice.addErasmusUploadedPdf', e));
  },
  removeErasmusUploadedPdf: (filename: string) => {
    const next = { ...get().erasmusUploadedPdfs };
    delete next[filename];
    set({ erasmusUploadedPdfs: next });
    IndexedDBService.set('meta', UPLOADED_PDFS_KEY, next).catch(e => reportError('ErasmusSlice.removeErasmusUploadedPdf', e));
  },
  clearErasmusUploadedPdfs: () => {
    set({ erasmusUploadedPdfs: {} });
    IndexedDBService.set('meta', UPLOADED_PDFS_KEY, {}).catch(e => reportError('ErasmusSlice.clearErasmusUploadedPdfs', e));
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
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(e => reportError('ErasmusSlice.addErasmusTableAOption', e));
  },
  removeErasmusTableAOption: (id: string) => {
    const next = get().erasmusTableAOptions.filter(o => o.id !== id);
    if (next.length === 0) {
      next.push({ id: `opt-${Date.now()}`, institutionName: '', erasmusCode: '', country: '', link: '', courses: [] });
    }
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(e => reportError('ErasmusSlice.removeErasmusTableAOption', e));
  },
  updateErasmusTableAOptionHeader: (id, data) => {
    const next = get().erasmusTableAOptions.map(o => o.id === id ? { ...o, ...data } : o);
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(e => reportError('ErasmusSlice.updateErasmusTableAOptionHeader', e));
  },
  addErasmusTableACourse: (optionId: string, course: { code: string; name: string; credits: number }) => {
    const next = get().erasmusTableAOptions.map(o => o.id === optionId ? { ...o, courses: [...o.courses, course] } : o);
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(e => reportError('ErasmusSlice.addErasmusTableACourse', e));
  },
  removeErasmusTableACourse: (optionId: string, index: number) => {
    const next = get().erasmusTableAOptions.map(o => o.id === optionId ? { ...o, courses: o.courses.filter((_, i) => i !== index) } : o);
    set({ erasmusTableAOptions: next });
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(e => reportError('ErasmusSlice.removeErasmusTableACourse', e));
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
    IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, next).catch(e => reportError('ErasmusSlice.reorderErasmusTableACourse', e));
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
           IndexedDBService.set('meta', TABLE_A_OPTIONS_KEY, initial).catch(e => reportError('ErasmusSlice.loadErasmusState:migrateTableA', e));
        }
      }

      const verdicts = await IndexedDBService.get('meta', VERDICTS_KEY) as Record<string, 'approved' | 'rejected'> | null;
      if (verdicts) set({ erasmusVerdicts: verdicts });

      const aiResults = await IndexedDBService.get('meta', AI_RESULTS_KEY) as Record<string, AIComparisonResult> | null;
      if (aiResults) set({ erasmusAiResults: aiResults });

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
    } catch (e) {
      reportError('ErasmusSlice.loadErasmusState', e);
    }
  },
});
