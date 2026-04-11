import type { ErasmusSlice, AppSlice } from '../types';
import { fetchErasmusReports, getStoredErasmusData, fetchErasmusConfig as fetchErasmusConfigApi } from '../../api/erasmus';
import { ERASMUS_COUNTRIES } from '../../constants/erasmusCountries';
import { IndexedDBService } from '../../services/storage';
import { loggers } from '../../utils/logger';

const DEFAULT_COUNTRY = ERASMUS_COUNTRIES.find(c => c.id === '705')!; // Slovenia
const SELECTED_COURSES_KEY = 'erasmus_selected_courses';
const ERASMUS_UI_STATE_KEY = 'erasmus_ui_state';

export const createErasmusSlice: AppSlice<ErasmusSlice> = (set, get) => ({
  erasmusData: null,
  erasmusLoading: false,
  erasmusCountryFile: '',
  erasmusConfig: null,
  erasmusSelectedCourses: [],
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
  toggleErasmusCourse: (code: string) => {
    const current = get().erasmusSelectedCourses;
    const next = current.includes(code)
      ? current.filter(c => c !== code)
      : [...current, code];
    set({ erasmusSelectedCourses: next });
    IndexedDBService.set('meta', SELECTED_COURSES_KEY, next).catch(() => {});
  },
  loadErasmusSelectedCourses: async () => {
    try {
      const stored = await IndexedDBService.get('meta', SELECTED_COURSES_KEY) as string[] | null;
      if (stored) set({ erasmusSelectedCourses: stored });

      const uiState = await IndexedDBService.get('meta', ERASMUS_UI_STATE_KEY) as { activeTab?: any; planPhase?: any } | null;
      if (uiState) {
        if (uiState.activeTab) set({ erasmusActiveTab: uiState.activeTab });
        if (uiState.planPhase) set({ erasmusPlanPhase: uiState.planPhase });
      }
    } catch { /* ignore */ }
  },
});
