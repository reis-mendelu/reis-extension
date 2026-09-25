import type {
  SuggestionAttachment,
  SuggestionRow,
  SuggestionStatus,
} from '../../types/suggestions';

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

// A stand-in screenshot for UI verification: an SVG, because the dev store
// never meets the server's JPEG check and an inline SVG needs no binary asset.
// Tall on purpose — a phone screenshot is the common shape.
const SHOT_SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="390" height="844"><rect width="390" height="844" fill="#e8f0e3"/><rect x="16" y="80" width="358" height="120" rx="12" fill="#79be15"/><text x="32" y="150" font-size="28" fill="#fff">Zkoušky</text><rect x="16" y="220" width="358" height="60" rx="8" fill="#fff"/><rect x="16" y="296" width="358" height="60" rx="8" fill="#fff"/></svg>`;

const ENTRY_MSGS = [
  'GET https://is.mendelu.cz/auth/student/terminy_seznam.pl -> 503',
  'Parser.parseExams: table header not found',
  'Warning: Each child in a list should have a unique "key" prop.',
];

const attachments: Record<number, SuggestionAttachment> = {
  1: {
    screenshot: null,
    diagnostics: {
      entries: ENTRY_MSGS.map((msg, i) => ({
        t: Date.parse('2026-08-01T17:39:00.000Z') + i * 4000,
        level: i === 2 ? 'warn' : 'error',
        source: i === 0 ? 'content' : 'app',
        ctx: i === 0 ? 'Api.fetchExams' : i === 1 ? 'Parser.parseExams' : null,
        ...(i === 0 ? { status: 503 } : {}),
        msg,
      })),
      env: { platform: 'extension', os: 'macOS', lang: 'cz', online: true, uptimeS: 812 },
      sync: {
        lastSync: Date.parse('2026-08-01T17:30:00.000Z'),
        isSyncing: false,
        schedule: 'success',
        exams: 'error',
        scheduleCount: 42,
        examsCount: 0,
        examsFetchedAt: null,
      },
    },
  },
};

// Row 1 carries both, row 2 a screenshot only, to exercise every badge.
rows = rows.map((r) =>
  r.id === 1
    ? { ...r, attachments: { has_screenshot: true, diagnostics_count: ENTRY_MSGS.length } }
    : r.id === 2
      ? { ...r, attachments: { has_screenshot: true, diagnostics_count: 0 } }
      : { ...r, attachments: null }
);

export const devSuggestionsStore = {
  list: (): SuggestionRow[] => [...rows],
  setStatus: (id: number, status: SuggestionStatus): void => {
    // Mirrors the server's trigger: resolving a report deletes its attachments.
    rows = rows.map((r) =>
      r.id === id ? { ...r, status, ...(status === 'done' ? { attachments: null } : {}) } : r
    );
    if (status === 'done') delete attachments[id];
  },
  attachments: (id: number): SuggestionAttachment => {
    const row = rows.find((r) => r.id === id);
    if (!row?.attachments) return { screenshot: null, diagnostics: null };
    return {
      screenshot: row.attachments.has_screenshot
        ? new Blob([SHOT_SVG], { type: 'image/svg+xml' })
        : null,
      diagnostics: attachments[id]?.diagnostics ?? null,
    };
  },
};
