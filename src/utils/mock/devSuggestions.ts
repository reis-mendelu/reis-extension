import type { SuggestionRow, SuggestionStatus } from '../../types/suggestions';

// In-memory stand-in for the Supabase `suggestions` table, mirroring
// devSocietyStore: a fake dev session cannot satisfy the RLS read policy, so
// admin reads route here when VITE_DEV_SOCIETY is set. Resets on reload.
let rows: SuggestionRow[] = [
  {
    id: 2,
    type: 'idea',
    title: 'Dark mode for the campus map',
    body: 'The map stays light while the rest of the app is dark.',
    contact: 'student@mendelu.cz',
    screen: 'map',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '1280x800',
    status: 'new',
    created_at: '2026-08-02T09:15:00.000Z',
  },
  {
    id: 1,
    type: 'bug',
    title: 'Exam list empty after enrolling',
    body: 'Enrolled for an exam, the panel stayed empty until I reloaded.',
    contact: null,
    screen: 'exams',
    ext_version: '4.0.0',
    browser_name: 'Firefox',
    browser_version: '142',
    viewport: '390x844',
    status: 'triaged',
    created_at: '2026-08-01T17:40:00.000Z',
  },
];

export const devSuggestionsStore = {
  list: (): SuggestionRow[] => [...rows],
  setStatus: (id: number, status: SuggestionStatus): void => {
    rows = rows.map((r) => (r.id === id ? { ...r, status } : r));
  },
};
