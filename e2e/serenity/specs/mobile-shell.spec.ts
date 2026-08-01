import { test, expect, type Page } from '@playwright/test';

// Defaults to 3000, but honours REIS_WEB_URL so the suite can follow the dev
// server when the harness has to assign a different port (something else may
// already hold 3000).
const BASE_URL = process.env.REIS_WEB_URL ?? 'http://localhost:3000';

// Mirrors src/i18n/locales/en.json's mobile.nav.* — BottomNav's aria-label
// per tab, used as the accessible name for `getByRole('button', ...)`.
/** The bottom nav is a <nav> landmark; scope tab clicks to it so IS-page
 *  entries with similar names (e.g. "Academic calendar") cannot collide. */
const bottomNav = (page: import('@playwright/test').Page) => page.getByRole('navigation');

const NAV = {
  calendar: 'Calendar',
  exams: 'Exams',
  subjects: 'Courses',
  map: 'Map',
  student: 'Student',
};

interface SeedSubjectStatus {
  id: string;
  code: string;
  name: string;
  credits: number;
  type: string;
  isEnrolled: boolean;
  isFulfilled: boolean;
  enrollmentCount: number;
  rawStatusText: string;
}

interface SeedStudyPlan {
  title: string;
  isFulfilled: boolean;
  creditsAcquired: number;
  creditsRequired: number;
  blocks: {
    title: string;
    groups: { name: string; statusDescription: string; subjects: SeedSubjectStatus[] }[];
  }[];
}

interface SeedDualLanguageStudyPlan {
  cz: SeedStudyPlan;
  en: SeedStudyPlan;
}

// isEnrolled makes getSemesterState() (SubjectsPanel/utils.ts) classify this
// block as 'current', so SubjectsScreen renders a SemesterCard row instead
// of its empty state.
const SEEDED_SUBJECT: SeedSubjectStatus = {
  id: 'e2e-subject-id',
  code: 'E2E-ALG',
  name: 'E2E Algorithms',
  credits: 5,
  type: 'PV',
  isEnrolled: true,
  isFulfilled: false,
  enrollmentCount: 1,
  rawStatusText: 'zapsáno',
};

const SEEDED_PLAN: SeedStudyPlan = {
  title: 'E2E Study Plan',
  isFulfilled: false,
  creditsAcquired: 30,
  creditsRequired: 180,
  blocks: [
    {
      title: '1. semestr',
      groups: [{ name: 'Povinné', statusDescription: '', subjects: [SEEDED_SUBJECT] }],
    },
  ],
};

const SEEDED_DUAL_PLAN: SeedDualLanguageStudyPlan = { cz: SEEDED_PLAN, en: SEEDED_PLAN };

// Wipes any reis_db/reis_db_mock IndexedDB left over from a previous run —
// it's per-origin and outlives a single test process, so a stale
// study_plan/schedule/reis_language entry could pass/fail an assertion below
// for the wrong reason. Uses CDP, not a page-script deleteDatabase(): that
// blocks forever once the app holds a live connection, which it always does
// by the time a test could call it.
async function clearStaleIndexedDb(page: Page): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Storage.clearDataForOrigin', { origin: BASE_URL, storageTypes: 'indexeddb' });
}

// Writes one value into the already-booted app's reis_db_mock via raw
// indexedDB (IndexedDBService is bundled app code, unreachable from here).
// The named store must already exist — i.e. the app has opened the DB once.
async function seedIndexedDbValue(
  page: Page,
  store: string,
  key: string,
  value: unknown
): Promise<void> {
  await page.evaluate(
    ({ store, key, value }) =>
      new Promise<void>((resolve, reject) => {
        const req = indexedDB.open('reis_db_mock');
        req.onerror = () => reject(req.error);
        req.onsuccess = () => {
          const tx = req.result.transaction(store, 'readwrite');
          tx.objectStore(store).put(value, key);
          tx.oncomplete = () => {
            req.result.close();
            resolve();
          };
          tx.onerror = () => {
            req.result.close();
            reject(tx.error);
          };
        };
      }),
    { store, key, value }
  );
}

// Navigates to the phone branch (`?mobile=1` forces it — dev/phoneOverride.ts)
// after wiping stale IndexedDB, then forces English: createI18nSlice.ts
// defaults to Czech until a 'reis_language' preference is stored, and
// clearStaleIndexedDb() just wiped it — without this every locator below
// (built from en.json) would wait out its timeout against Czech text.
async function gotoMobile(page: Page): Promise<void> {
  await clearStaleIndexedDb(page);
  await page.goto(`${BASE_URL}/?mobile=1`);
  await expect(page.getByTestId('mobile-app')).toBeVisible();
  await seedIndexedDbValue(page, 'meta', 'reis_language', 'en');
  await page.reload();
  await expect(page.getByTestId('mobile-app')).toBeVisible();
}

// The standalone webapp has no content script to answer the REIS_READY
// handshake, so createSyncSlice's 10s handshakeTimedOut fallback — not a
// real sync — is what unblocks the Calendar/Exams/Subjects skeletons. 15s
// leaves margin over that raw 10s timer.
async function waitForHandshake(page: Page): Promise<void> {
  await expect(page.getByTestId('calendar-screen')).toBeVisible({ timeout: 15000 });
}

// Mock mode (VITE_USE_MOCK_DATA=true) seeds exams/schedule only (see
// src/utils/mock/data/*.ts, MockManager.loadDataset) — never study_plan, so
// SubjectsScreen always renders its empty state under dev:web:mock alone.
// Writes a minimal plan into IndexedDB, then reloads so fetchStudyPlan()
// picks it up on a fresh boot. Must run after the FIRST handshake resolves:
// fetchStudyPlan fires on a queueMicrotask at boot (useAppStore.ts), so
// seeding before the app has even opened the database would lose that race
// and read back nothing.
async function seedStudyPlanAndReload(page: Page): Promise<void> {
  await seedIndexedDbValue(page, 'study_plan', 'current', SEEDED_DUAL_PLAN);
  await page.reload();
  await expect(page.getByTestId('mobile-app')).toBeVisible();
  await waitForHandshake(page);
}

test.describe('mobile shell', () => {
  // Guard for spec risk R1. If touch emulation ever stops producing
  // `pointer: coarse`, every other mobile test would silently exercise the
  // DESKTOP tree and still pass. This fails loudly instead.
  test('phone branch mounts under touch emulation', async ({ page }) => {
    await clearStaleIndexedDb(page);
    await page.goto(`${BASE_URL}/`);
    await expect(page.getByTestId('mobile-app')).toBeVisible();
  });

  test('tab switching reaches all five screens', async ({ page }) => {
    await gotoMobile(page);
    await waitForHandshake(page);
    await expect(page.getByTestId('calendar-screen')).toBeVisible();

    await bottomNav(page).getByRole('button', { name: NAV.exams }).click();
    await expect(page.getByTestId('exams-screen')).toBeVisible();

    await bottomNav(page).getByRole('button', { name: NAV.subjects }).click();
    await expect(page.getByTestId('subjects-screen')).toBeVisible();

    await bottomNav(page).getByRole('button', { name: NAV.map }).click();
    await expect(page.getByTestId('map-screen')).toBeVisible();

    await bottomNav(page).getByRole('button', { name: NAV.student }).click();
    await expect(page.getByTestId('student-screen')).toBeVisible();

    await bottomNav(page).getByRole('button', { name: NAV.calendar }).click();
    await expect(page.getByTestId('calendar-screen')).toBeVisible();
  });

  test('tapping a subject opens the drawer sheet and its tabs switch', async ({ page }) => {
    await gotoMobile(page);
    await waitForHandshake(page);
    await seedStudyPlanAndReload(page);

    await bottomNav(page).getByRole('button', { name: NAV.subjects }).click();
    const subjectRow = page
      .getByTestId('subjects-screen')
      .getByRole('button', { name: /E2E Algorithms/ });
    await expect(subjectRow).toBeVisible();
    await subjectRow.click();

    const sheetPanel = page.getByTestId('sheet-panel');
    await expect(sheetPanel).toBeVisible();
    await expect(sheetPanel.getByText('E2E Algorithms')).toBeVisible();

    // No subjectId resolves for a fabricated subject (files/classmates/
    // zaznamnik need a real IS enrollment id — SubjectDrawerSheet's
    // NO_ID_DISABLED), so it opens on "Success" with only "Success"/
    // "Syllabus" enabled to switch between.
    const successTab = sheetPanel.getByRole('button', { name: 'Success' });
    const syllabusTab = sheetPanel.getByRole('button', { name: 'Syllabus' });
    await expect(successTab).toHaveClass(/border-primary/);

    await syllabusTab.click();
    await expect(syllabusTab).toHaveClass(/border-primary/);
    await expect(successTab).not.toHaveClass(/border-primary/);
  });

  test('opening Eduroam from Student shows its sheet, and the backdrop dismisses it', async ({
    page,
  }) => {
    await gotoMobile(page);

    // Student and the BottomNav itself aren't gated on the sync handshake,
    // so this test doesn't need waitForHandshake().
    await bottomNav(page).getByRole('button', { name: NAV.student }).click();
    await expect(page.getByTestId('student-screen')).toBeVisible();

    // Exact full accessible name (title span + subtitle span, concatenated):
    // a plain substring match on "Eduroam" also hits an IS-pages list entry
    // whose label parenthetically mentions "(eduroam)".
    await page.getByRole('button', { name: 'Eduroam Wi-Fi in two taps', exact: true }).click();
    const sheetPanel = page.getByTestId('sheet-panel');
    await expect(sheetPanel).toBeVisible();
    await expect(sheetPanel.getByText('Get on eduroam in a few minutes')).toBeVisible();

    await page.getByTestId('sheet-backdrop').click();
    await expect(sheetPanel).not.toBeVisible();
  });
});
