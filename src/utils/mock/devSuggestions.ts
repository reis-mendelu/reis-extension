import type { SuggestionRow, SuggestionStatus } from '../../types/suggestions';

// In-memory stand-in for the Supabase `suggestions` table, mirroring
// devSocietyStore: a fake dev session cannot satisfy the RLS read policy, so
// admin reads route here when VITE_DEV_SOCIETY is set. Resets on reload.
// Worst case the schema permits, for UI verification: title at its 120-char
// limit with no spaces, body at its 2000-char limit containing an unbroken
// token, and a long unbroken contact. Student text is free-form, so the modal
// must survive this — it is the overflow case, not a decorative sample.
const UNBROKEN_TITLE = 'A'.repeat(120);
const UNBROKEN_TOKEN = 'x'.repeat(300);
const TORTURE_BODY = `${'slovo '.repeat(200)}${UNBROKEN_TOKEN} ${'konec '.repeat(80)}`.slice(
  0,
  2000
);

let rows: SuggestionRow[] = [
  {
    id: 3,
    type: 'other',
    title: UNBROKEN_TITLE,
    body: TORTURE_BODY,
    contact: `${'m'.repeat(60)}@${'d'.repeat(50)}.cz`,
    screen: 'studyPlan',
    ext_version: '4.0.0',
    browser_name: 'Chrome',
    browser_version: '131',
    viewport: '320x568',
    status: 'new',
    created_at: '2026-08-03T08:00:00.000Z',
  },
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
