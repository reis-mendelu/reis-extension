import type { ErasmusSlice, AppSlice } from '../types';
import { fetchErasmusReports, getStoredErasmusData, fetchErasmusConfig as fetchErasmusConfigApi } from '../../api/erasmus';
import { fetchLearningAgreement } from '../../api/erasmusLA';
import { getUserParams } from '../../utils/userParams';
import { IndexedDBService } from '../../services/storage';
import { loggers } from '../../utils/logger';

const SELECTED_COURSES_KEY = 'erasmus_selected_courses';
const ERASMUS_UI_STATE_KEY = 'erasmus_ui_state';
const VERDICTS_KEY = 'erasmus_verdicts';
const PDF_ASSIGNMENTS_KEY = 'erasmus_pdf_assignments';
const PINNED_UNIVERSITIES_KEY = 'erasmus_pinned_universities';
const UPLOADED_PDFS_KEY = 'erasmus_uploaded_pdfs';
const MAX_PINNED = 4;

export const createErasmusSlice: AppSlice<ErasmusSlice> = (set, get) => ({
  erasmusData: null,
  erasmusLoading: false,
  erasmusCountryFile: '',
  erasmusConfig: null,
  erasmusSelectedCourses: [],
  erasmusVerdicts: {},
  erasmusPdfAssignments: {},
  erasmusPinnedUniversities: [],
  erasmusUploadedPdfs: {},
  erasmusLA: null,
  erasmusLALoading: false,
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
  fetchErasmusLA: async () => {
    if (get().erasmusLALoading) return;
    set({ erasmusLALoading: true });
    try {
      const params = await getUserParams();
      if (!params?.studium || !params?.obdobi) return;
      const lang = get().language === 'en' ? 'en' : 'cz';
      const data = await fetchLearningAgreement(params.studium, params.obdobi, lang);
      if (data) set({ erasmusLA: data });
    } catch (err) {
      loggers.ui.error('[ErasmusSlice] LA fetch failed:', err);
    } finally {
      set({ erasmusLALoading: false });
    }
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
  toggleErasmusCourse: (code: string) => {
    const current = get().erasmusSelectedCourses;
    const isRemoving = current.includes(code);
    const next = isRemoving ? current.filter(c => c !== code) : [...current, code];
    set({ erasmusSelectedCourses: next });
    IndexedDBService.set('meta', SELECTED_COURSES_KEY, next).catch(() => {});
    if (isRemoving) {
      const verdicts = { ...get().erasmusVerdicts };
      delete verdicts[code];
      set({ erasmusVerdicts: verdicts });
      IndexedDBService.set('meta', VERDICTS_KEY, verdicts).catch(() => {});
    }
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
  loadErasmusSelectedCourses: async () => {
    try {
      const stored = await IndexedDBService.get('meta', SELECTED_COURSES_KEY) as string[] | null;
      if (stored) set({ erasmusSelectedCourses: stored });

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
