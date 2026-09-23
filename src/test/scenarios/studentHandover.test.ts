import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * The handover, end to end, over a real database.
 *
 * Every other test around this change mocks at a module boundary, which
 * verifies the mechanism and not the scenario. The scenario is what was
 * reported: sign out, hand the laptop over, the next student signs in — and
 * none of their data loads, on an install that has to be deleted and re-added
 * to recover.
 *
 * So the only things faked here are the two boundaries a test cannot cross:
 * the IS HTTP calls (`userParams/fetchers`) and the society sign-out, which
 * talks to Supabase. `IndexedDBService`, `getUserParams`, the sign-out paths
 * and the wipe are all the real modules, running against a real (fake-indexeddb)
 * database — including its validation, so a seeded value that the schemas would
 * drop cannot make an assertion pass by being absent.
 *
 * The central assertion is deliberately not "the keys I remember are gone". It
 * dumps EVERY object store raw, underneath `IndexedDBService`'s validation, and
 * asserts the departed student's identifiers appear nowhere in any of them.
 */

const fetchUserBaseIds = vi.fn();
const fetchUserStudyDetails = vi.fn(async () => ({}));
const fetchUserNetId = vi.fn(async () => ({ username: '' }));

vi.mock('../../utils/userParams/fetchers', () => ({
  fetchUserBaseIds: () => fetchUserBaseIds(),
  fetchUserStudyDetails: () => fetchUserStudyDetails(),
  fetchUserNetId: () => fetchUserNetId(),
}));

// The society login, down to where it is actually kept. Only the network edge
// is faked (Supabase's revoke); `clearAdminSession` itself runs for real
// against an in-memory `chrome.storage.local`, so these scenarios assert the
// credential is GONE — the state that decides who gets into the console — not
// merely that a function with the right name was called.
const ADMIN_KEY = 'reis_admin_auth';
const adminStore = new Map<string, string>();
vi.mock('../../services/admin/authClient', () => ({
  ADMIN_AUTH_STORAGE_KEY: 'reis_admin_auth',
  adminAuthClient: { auth: { signOut: async () => ({ error: null }) } },
}));
vi.mock('../../services/admin/chromeStorageAdapter', () => ({
  chromeStorageAdapter: {
    getItem: async (k: string) => adminStore.get(k) ?? null,
    setItem: async (k: string, v: string) => void adminStore.set(k, v),
    removeItem: async (k: string) => void adminStore.delete(k),
  },
}));

const { IndexedDBService, INSTALL_ID_KEY } =
  await import('../../services/storage/IndexedDBService');
const { getUserParams, clearUserParamsCache } = await import('../../utils/userParams');
const { onIdentityChange } = await import('../../utils/userParams/identityEvents');
const { watchSignedInStudent } = await import('../../services/identity/watchSignedInStudent');
const { signOutFromHostPage } = await import('../../injector/hostSignOut');
const { logout } = await import('../../api/proxyClient');
const { setPlatform, __resetPlatformForTests } = await import('../../platform');

/** Two real students, in the shape `studium.pl` yields them. */
const PETR = {
  studium: '149707',
  obdobi: '812',
  studentId: '120344',
  fullName: 'Petr Svoboda',
  isErasmus: false,
};
const TONDA = {
  studium: '201555',
  obdobi: '999',
  studentId: '987654',
  fullName: 'Tonda Vomáčka',
  isErasmus: false,
};

// The full shape the store's schema requires — a short one would be dropped
// on write, and every assertion below would then pass on an empty database.
const lesson = (owner: typeof PETR) => ({
  id: `lesson-${owner.studentId}`,
  date: '2026-09-22',
  startTime: '08:00',
  endTime: '09:50',
  courseName: 'Matematika',
  courseCode: 'MT',
  courseId: '1',
  room: 'Q01',
  roomStructured: { name: 'Q01', id: '1' },
  teachers: [{ fullName: owner.fullName, shortName: 'doc.', id: owner.studentId }],
  periodId: owner.obdobi,
  studyId: owner.studium,
  campus: 'Brno',
  isDefaultCampus: 'true',
  facultyCode: 'PEF',
  isSeminar: 'false',
  isConsultation: 'false',
});

/** Everything a signed-in student accumulates, written through the real API. */
async function seedStudentData(owner: typeof PETR) {
  await IndexedDBService.set('meta', 'reis_user_params', owner);
  await IndexedDBService.set('schedule', 'current', [lesson(owner)]);
  await IndexedDBService.set('meta', 'reis_current_view', 'calendar');
  await IndexedDBService.set('meta', 'study_stats', { studentId: owner.studentId, credits: 42 });
  await IndexedDBService.set('classmates', 'MT', [
    {
      personId: Number(owner.studentId),
      photoUrl: `/img.pl?id=${owner.studentId}`,
      name: owner.fullName,
      studyInfo: `PEF, ${owner.studium}`,
    },
  ]);
}

/**
 * Every store, read raw — underneath IndexedDBService's schema validation, so
 * a value it would refuse to hand back still shows up here. "Deleted" has to
 * mean deleted, not hidden.
 */
async function dumpEverything(): Promise<string> {
  const db: IDBDatabase = await new Promise((resolve, reject) => {
    const req = indexedDB.open('reis_db');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  const out: Record<string, unknown[]> = {};
  for (const store of Array.from(db.objectStoreNames)) {
    // A failed read rejects rather than reading as empty: an empty store is a
    // pass here, so a read that quietly returned [] could hide the very data
    // these tests look for.
    out[store] = await new Promise((resolve, reject) => {
      const req = db.transaction(store).objectStore(store).getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  db.close();
  return JSON.stringify(out);
}

function expectNoTraceOf(dump: string, owner: typeof PETR) {
  for (const marker of [owner.studium, owner.studentId, owner.fullName]) {
    expect(dump.includes(marker), `"${marker}" is still in the database`).toBe(false);
  }
}

describe('handing the browser to the next student', () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    fetchUserStudyDetails.mockResolvedValue({});
    fetchUserNetId.mockResolvedValue({ username: '' });
    clearUserParamsCache();
    await IndexedDBService.clearAll();
    adminStore.clear();
    window.history.replaceState({}, '', '/auth/student/studium.pl');
  });

  afterEach(() => {
    __resetPlatformForTests();
  });

  /**
   * The reported path: Petr signs out, Tonda signs in.
   *
   * Both halves of the sign-out run here. In production they run in different
   * origins against different copies of `reis_db` — which a single-process
   * test cannot reproduce — so pointing both at one database is the stricter
   * check: each half has to leave nothing behind, and between them the store
   * must be empty.
   */
  it('leaves nothing of the student who signed out, and serves the next one their own data', async () => {
    await seedStudentData(PETR);
    adminStore.set(ADMIN_KEY, 'petr-society-session');
    // The seed has to be real, or everything below passes vacuously.
    expect(await IndexedDBService.get('schedule', 'current')).toHaveLength(1);
    expect(dumpEverythingIncludes(await dumpEverything(), PETR)).toBe(true);

    // Sign out — the iframe's half…
    setPlatform({
      kind: 'extension',
      storage: { async get() {}, async set() {}, async remove() {} },
      secureStorage: { async get() {}, async set() {}, async remove() {} },
      getAssetUrl: (p: string) => `/${p}`,
    } as never);
    const postMessage = vi.spyOn(window.parent, 'postMessage').mockImplementation(() => {});
    void logout().catch(() => {});
    // Its last step asks the host page to sign out — and the host's wipe below
    // only happens in production if this message is actually sent.
    await vi.waitFor(() =>
      expect(postMessage).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REIS_ACTION', action: 'logout' }),
        '*'
      )
    );
    postMessage.mockRestore();
    expect(adminStore.has(ADMIN_KEY)).toBe(false);
    // Checked BEFORE the host's half. Both halves share one database here,
    // unlike production, so the host's wipe would otherwise hide anything the
    // iframe's own wipe left behind.
    expectNoTraceOf(await dumpEverything(), PETR);

    // …and the host page's half, the one no sign-out used to reach.
    await signOutFromHostPage();

    expectNoTraceOf(await dumpEverything(), PETR);

    // Tonda signs in. Fresh context: no in-memory cache survives the reload.
    clearUserParamsCache();
    fetchUserBaseIds.mockResolvedValue(TONDA);
    fetchUserNetId.mockResolvedValue({ username: 'xvomacka' });

    const params = await getUserParams();
    expect(params?.studium).toBe('201555');
    expect(params?.studentId).toBe('987654');
    // What the crawl will carry — the field that was wrong in the report.
    expect((await IndexedDBService.get('meta', 'reis_user_params')) as typeof TONDA).toMatchObject({
      studium: '201555',
      obdobi: '999',
    });
    expectNoTraceOf(await dumpEverything(), PETR);
  });

  /**
   * And the path nobody chooses: Petr never signs out, Tonda just logs into IS
   * on the same browser. Nothing has wiped anything, so the identity check is
   * the only thing standing between Tonda and a session spent crawling under
   * Petr's `studium`.
   */
  it('wipes and restarts when the student changes without a sign-out', async () => {
    await seedStudentData(PETR);
    expect(dumpEverythingIncludes(await dumpEverything(), PETR)).toBe(true);

    const restarts: unknown[] = [];
    const off = onIdentityChange((p) => restarts.push(p));
    clearUserParamsCache(); // a fresh page load, with Petr's data still on disk
    fetchUserBaseIds.mockResolvedValue(TONDA);
    fetchUserNetId.mockResolvedValue({ username: 'xvomacka' });

    const params = await getUserParams();

    expect(params?.studentId).toBe('987654');
    // The app has to be told: the store still holds Petr's schedule in memory,
    // where no database wipe reaches it.
    expect(restarts).toHaveLength(1);
    expectNoTraceOf(await dumpEverything(), PETR);
    off();

    // The restart itself: a fresh context reads what is on disk and finds only
    // Tonda — no second wipe, no loop.
    clearUserParamsCache();
    const afterRestart = await getUserParams();
    expect(afterRestart?.studium).toBe('201555');
    expect(await IndexedDBService.get('schedule', 'current')).toBeUndefined();
  });

  /**
   * The same path, through the real watcher, for the credential the wipe does
   * not reach. Petr's society login lives in `chrome.storage.local`; sign-out
   * drops it, and this path used to leave it — so Tonda, on the same browser,
   * opened Petr's society console. It has to go before the restart.
   */
  it('drops the previous student’s society login when the student changes without a sign-out', async () => {
    await seedStudentData(PETR);
    adminStore.set(ADMIN_KEY, 'petr-society-session');
    clearUserParamsCache();
    fetchUserBaseIds.mockResolvedValue(TONDA);
    fetchUserNetId.mockResolvedValue({ username: 'xvomacka' });

    // What is in storage at the moment of the restart — the restart ends the
    // page, so a credential still there then survives into Tonda's session.
    let credentialAtRestart: boolean | null = null;
    const restart = vi.fn(() => {
      credentialAtRestart = adminStore.has(ADMIN_KEY);
    });

    const stop = watchSignedInStudent(restart, { attempts: 1 });
    await vi.waitFor(() => expect(restart).toHaveBeenCalledTimes(1));
    stop();

    expect(credentialAtRestart).toBe(false);
    expectNoTraceOf(await dumpEverything(), PETR);
  });

  /**
   * The install id is the one thing that survives, and it must: it is a random
   * UUID with no relationship to the student, and minting a fresh one on every
   * sign-out would count one device as a new install each time.
   */
  it('keeps the random install id and nothing else', async () => {
    await IndexedDBService.set('meta', INSTALL_ID_KEY, 'b0a7f0c2-0000-4000-8000-000000000000');
    await seedStudentData(PETR);

    await signOutFromHostPage();

    expect(await IndexedDBService.get('meta', INSTALL_ID_KEY)).toBe(
      'b0a7f0c2-0000-4000-8000-000000000000'
    );
    expectNoTraceOf(await dumpEverything(), PETR);
  });
});

/** Inverse of expectNoTraceOf, for asserting the seed actually landed. */
function dumpEverythingIncludes(dump: string, owner: typeof PETR): boolean {
  return (
    dump.includes(owner.studium) && dump.includes(owner.studentId) && dump.includes(owner.fullName)
  );
}
