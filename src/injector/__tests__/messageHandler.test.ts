/**
 * handleMessage is the trust boundary of the whole host integration. It runs in
 * the content script, which holds the student's IS session cookies, and it will
 * fetch any URL a message names with `credentials: 'include'`.
 *
 * The three guards at the top are therefore load-bearing security, not
 * defensiveness: is.mendelu.cz is a site with user-authored content, and any
 * frame on the page can call window.postMessage. Drop the origin or source check
 * and the page can read the student's authenticated IS pages through us.
 *
 * The real Zod validator and Messages factory are used deliberately -- mocking
 * them would leave the actual validation untested.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Messages } from '../../types/messages';

const sendToIframe = vi.hoisted(() => vi.fn());
const markIframeReady = vi.hoisted(() => vi.fn());
const requestSync = vi.hoisted(() => vi.fn());
const fetchFullSemesterSchedule = vi.hoisted(() => vi.fn());
const fetchExamData = vi.hoisted(() => vi.fn());
const fetchSubjects = vi.hoisted(() => vi.fn());
const isIsMendeluUrl = vi.hoisted(() => vi.fn());
const registerExam = vi.hoisted(() => vi.fn());
const unregisterExam = vi.hoisted(() => vi.fn());
const downloadDocumentInPage = vi.hoisted(() => vi.fn());
const refreshExams = vi.hoisted(() => vi.fn());
const runDriveBackupNow = vi.hoisted(() => vi.fn());
const runNotesBackupNow = vi.hoisted(() => vi.fn());
const setNotesSnapshot = vi.hoisted(() => vi.fn());
const setNotesHtmlOverride = vi.hoisted(() => vi.fn());

const contentWindow = { name: 'iframe-window' } as unknown as Window;

vi.mock('../iframeManager', () => ({
  iframeElement: { contentWindow },
  sendToIframe,
  markIframeReady,
}));
vi.mock('../syncService', () => ({
  cachedData: { lastSync: 1, files: { CZ: [] } },
  isSyncing: false,
  runDriveBackupNow,
  runNotesBackupNow,
  setNotesSnapshot,
  setNotesHtmlOverride,
  refreshExams,
}));
vi.mock('../syncGate', () => ({ requestSync }));
vi.mock('../dataFetchers', () => ({ fetchFullSemesterSchedule }));
vi.mock('../../api/exams', () => ({ fetchExamData, registerExam, unregisterExam }));
vi.mock('../../api/subjects', () => ({ fetchSubjects }));
vi.mock('../sniper', () => ({ scrapedNavMenu: null }));
vi.mock('../documentDownloader', () => ({ downloadDocumentInPage }));
vi.mock('../isMendeluUrl', () => ({ isIsMendeluUrl }));

const ORIGIN = 'chrome-extension://abcdef';

let handleMessage: (e: MessageEvent) => Promise<void>;

beforeEach(async () => {
  // resetAllMocks, not clearAllMocks: clear wipes call history but LEAVES
  // implementations, so a `mockRejectedValue` set by one test (drive quota,
  // IS 502, term full, IS timeout) stayed installed for every test after it.
  // Under --sequence.shuffle that put a rejection in front of the test that
  // expects success, and the suite failed on roughly half the seeds. These mocks
  // are all bare vi.fn()s with no factory default, so resetting them is safe.
  vi.resetAllMocks();
  vi.resetModules();
  vi.stubGlobal('chrome', {
    runtime: { getURL: () => `${ORIGIN}/`, sendMessage: vi.fn() },
  });
  handleMessage = (await import('../messageHandler')).handleMessage;
});

/**
 * Restored in a hook, not at the end of the test body. The session-expiry case
 * replaces window.location to capture the navigation; restoring it inline means a
 * failed assertion above returns early and leaves it clobbered for every later
 * test in the file -- and intra-file order is shuffled in CI.
 */
const realLocation = window.location;
afterEach(() => {
  Object.defineProperty(window, 'location', { configurable: true, value: realLocation });
});

/** A well-formed event from the real iframe, so only the field under test differs. */
function event(over: Partial<MessageEvent> = {}): MessageEvent {
  return {
    origin: ORIGIN,
    source: contentWindow,
    data: Messages.requestData('schedule'),
    ...over,
  } as MessageEvent;
}

describe('trust boundary', () => {
  it('ignores a message from another origin', async () => {
    // The IS page itself posting as if it were our iframe.
    await handleMessage(event({ origin: 'https://is.mendelu.cz' }));
    expect(sendToIframe).not.toHaveBeenCalled();
    expect(fetchFullSemesterSchedule).not.toHaveBeenCalled();
  });

  it('ignores a message whose source is not our iframe', async () => {
    // Right origin, wrong window: another extension frame, or a page that got a
    // handle to one. Origin alone is not enough.
    await handleMessage(event({ source: { name: 'someone-else' } as unknown as Window }));
    expect(sendToIframe).not.toHaveBeenCalled();
    expect(fetchFullSemesterSchedule).not.toHaveBeenCalled();
  });

  it('ignores a payload that fails schema validation', async () => {
    await handleMessage(event({ data: { type: 'REIS_REQUEST_DATA' } }));
    expect(sendToIframe).not.toHaveBeenCalled();
  });

  it('ignores a completely unknown message type', async () => {
    await handleMessage(event({ data: { type: 'EVIL', url: 'https://attacker' } }));
    expect(sendToIframe).not.toHaveBeenCalled();
  });

  it('ignores non-object payloads', async () => {
    await handleMessage(event({ data: 'REIS_REQUEST_DATA' }));
    await handleMessage(event({ data: null }));
    expect(sendToIframe).not.toHaveBeenCalled();
  });
});

describe('REIS_READY', () => {
  it('flushes the queue and replays current state', async () => {
    await handleMessage(event({ data: Messages.ready() }));

    expect(markIframeReady).toHaveBeenCalledTimes(1);
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REIS_SYNC_UPDATE' })
    );
  });
});

describe('REIS_REQUEST_DATA', () => {
  it('answers a schedule request from the semester fetcher', async () => {
    fetchFullSemesterSchedule.mockResolvedValue([{ id: 'lesson' }]);

    await handleMessage(event({ data: Messages.requestData('schedule') }));

    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REIS_DATA', dataType: 'schedule' })
    );
  });

  it('reports the error back instead of leaving the iframe waiting', async () => {
    // The iframe has an outstanding promise per request; swallowing the throw
    // here is what turns a failed fetch into a spinner that never resolves.
    fetchFullSemesterSchedule.mockRejectedValue(new Error('IS timeout'));

    await handleMessage(event({ data: Messages.requestData('schedule') }));

    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REIS_DATA',
        dataType: 'schedule',
        error: expect.stringContaining('IS timeout'),
      })
    );
  });

  it('serves files straight from cache without a network call', async () => {
    await handleMessage(event({ data: Messages.requestData('files') }));

    expect(fetchFullSemesterSchedule).not.toHaveBeenCalled();
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REIS_DATA', dataType: 'files' })
    );
  });
});

describe('REIS_FETCH against IS', () => {
  beforeEach(() => isIsMendeluUrl.mockReturnValue(true));

  it('sends IS requests credentialed, from the cookie-holding context', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      status: 200,
      text: async () => '<html/>',
      headers: new Headers(),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const msg = Messages.fetch('https://is.mendelu.cz/auth/x');
    await handleMessage(event({ data: msg }));

    expect(fetchMock).toHaveBeenCalledWith(
      'https://is.mendelu.cz/auth/x',
      expect.objectContaining({ credentials: 'include' })
    );
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REIS_FETCH_RESULT', id: msg.id, success: true })
    );
  });

  it('reports a failure rather than a success for a non-2xx', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 500,
        text: async () => 'boom',
        headers: new Headers(),
      }))
    );

    const msg = Messages.fetch('https://is.mendelu.cz/x');
    await handleMessage(event({ data: msg }));

    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ id: msg.id, success: false })
    );
  });

  it('sends the student back to the login page when the session has lapsed', async () => {
    // A 401 from IS means the cookie died, and every later request will fail the
    // same way. Reporting the error without redirecting leaves the app retrying
    // forever against a session that cannot come back.
    let navigatedTo = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...realLocation,
        get href() {
          return '';
        },
        set href(v: string) {
          navigatedTo = v;
        },
        pathname: '/auth/index.pl',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 401,
        text: async () => 'login page',
        headers: new Headers(),
      }))
    );

    const msg = Messages.fetch('https://is.mendelu.cz/auth/x');
    await handleMessage(event({ data: msg }));

    expect(navigatedTo).toContain('login.pl');
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ id: msg.id, success: false })
    );
  });

  it('also redirects on 403, not only 401', async () => {
    // IS answers a dead session with either. Handling only 401 leaves a
    // 403-expired student in a silent retry loop.
    let navigatedTo = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...realLocation,
        get href() {
          return '';
        },
        set href(v: string) {
          navigatedTo = v;
        },
        pathname: '/auth/index.pl',
      },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 403,
        text: async () => 'forbidden',
        headers: new Headers(),
      }))
    );

    await handleMessage(event({ data: Messages.fetch('https://is.mendelu.cz/auth/x') }));

    expect(navigatedTo).toContain('login.pl');
  });

  it('rejects an image response that is not actually an image', async () => {
    // An expired session answers a photo request with the HTML login page. Data-
    // URL-ing that would paint the login form into an <img> as the student's face.
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'text/html' }),
        blob: async () => new Blob(['<html/>']),
      }))
    );

    const msg = Messages.fetch('https://is.mendelu.cz/auth/foto.pl', {
      responseType: 'image',
    });
    await handleMessage(event({ data: msg }));

    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({
        id: msg.id,
        success: false,
        error: expect.stringContaining('Not an image'),
      })
    );
  });
});

describe('REIS_FETCH via the background worker', () => {
  beforeEach(() => isIsMendeluUrl.mockReturnValue(false));

  it('retries a transient failure and succeeds', async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce(null) // service worker asleep
      .mockResolvedValueOnce({ success: true, data: 'ok' });
    vi.stubGlobal('chrome', { runtime: { getURL: () => `${ORIGIN}/`, sendMessage: send } });
    vi.useFakeTimers();

    const msg = Messages.fetch('https://cdn/x');
    const p = handleMessage(event({ data: msg }));
    await vi.runAllTimersAsync();
    await p;
    vi.useRealTimers();

    expect(send).toHaveBeenCalledTimes(2);
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ id: msg.id, success: true })
    );
  });

  it('does NOT retry a 4xx', async () => {
    // A 404 on the CDN is an answer, not a hiccup. Retrying it just triples the
    // latency of every miss.
    const send = vi.fn().mockResolvedValue({ success: false, error: 'HTTP 404' });
    vi.stubGlobal('chrome', { runtime: { getURL: () => `${ORIGIN}/`, sendMessage: send } });
    vi.useFakeTimers();

    const msg = Messages.fetch('https://cdn/missing');
    const p = handleMessage(event({ data: msg }));
    await vi.runAllTimersAsync();
    await p;
    vi.useRealTimers();

    expect(send).toHaveBeenCalledTimes(1);
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ id: msg.id, success: false })
    );
  });

  it('gives up after three attempts', async () => {
    const send = vi.fn().mockResolvedValue({ success: false, error: 'HTTP 503' });
    vi.stubGlobal('chrome', { runtime: { getURL: () => `${ORIGIN}/`, sendMessage: send } });
    vi.useFakeTimers();

    const msg = Messages.fetch('https://cdn/x');
    const p = handleMessage(event({ data: msg }));
    await vi.runAllTimersAsync();
    await p;
    vi.useRealTimers();

    expect(send).toHaveBeenCalledTimes(3);
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ id: msg.id, success: false })
    );
  });
});

/**
 * handleAction is the WRITE half of the boundary. Everything above only reads;
 * these cases change state on the university's servers on the student's behalf,
 * or navigate them away from the page.
 *
 * The direction of an exam action is the sharpest thing here: register and
 * unregister take the same argument and differ only in which function is called,
 * so a transposition type-checks, reads correctly, and silently does the exact
 * opposite of what the student clicked.
 */
describe('REIS_ACTION', () => {
  /** Dispatch an action and hand back the message, for its generated id. */
  async function act(action: string, payload: unknown = {}) {
    const msg = Messages.action(action as Parameters<typeof Messages.action>[0], payload);
    await handleMessage(event({ data: msg }));
    return msg;
  }

  const resultFor = (id: string) =>
    sendToIframe.mock.calls
      .map(
        (c) =>
          c[0] as {
            type: string;
            id?: string;
            success?: boolean;
            error?: string;
            data?: unknown;
          }
      )
      .find((m) => m.type === 'REIS_ACTION_RESULT' && m.id === id);

  describe('exam registration', () => {
    it('registers — and does NOT unregister', async () => {
      registerExam.mockResolvedValue({ success: true });

      const msg = await act('register_exam', { termId: 'T-1' });

      expect(registerExam).toHaveBeenCalledWith('T-1');
      expect(unregisterExam).not.toHaveBeenCalled();
      expect(resultFor(msg.id)?.success).toBe(true);
      // The API's own result reaches the iframe intact, not nested inside
      // another success field where a failure would read as truthy.
      expect(resultFor(msg.id)?.data).toEqual({ success: true });
    });

    it('unregisters — and does NOT register', async () => {
      unregisterExam.mockResolvedValue({ success: true });

      const msg = await act('unregister_exam', { termId: 'T-1' });

      expect(unregisterExam).toHaveBeenCalledWith('T-1');
      expect(registerExam).not.toHaveBeenCalled();
      expect(resultFor(msg.id)?.success).toBe(true);
    });

    it('refuses to register without a term id rather than guessing', async () => {
      const msg = await act('register_exam', {});

      expect(registerExam).not.toHaveBeenCalled();
      expect(resultFor(msg.id)).toMatchObject({
        success: false,
        error: expect.stringContaining('missing termId'),
      });
    });

    it('refuses to unregister without a term id', async () => {
      const msg = await act('unregister_exam', {});

      expect(unregisterExam).not.toHaveBeenCalled();
      expect(resultFor(msg.id)?.success).toBe(false);
    });

    it('passes a failed registration through with its error message', async () => {
      // The API reports refusals as a RESOLVED ExamActionResult, not a throw.
      // Wrapping it in another object made success truthy and dropped the text
      // the student needs.
      registerExam.mockResolvedValue({ success: false, error: 'Termín je již plný.' });

      const msg = await act('register_exam', { termId: 'T-8' });

      expect(resultFor(msg.id)?.data).toEqual({
        success: false,
        error: 'Termín je již plný.',
      });
    });

    it('reports a rejected registration back instead of claiming success', async () => {
      registerExam.mockRejectedValue(new Error('term full'));

      const msg = await act('register_exam', { termId: 'T-9' });

      expect(resultFor(msg.id)).toMatchObject({
        success: false,
        error: expect.stringContaining('term full'),
      });
    });
  });

  describe('sync and refresh', () => {
    it('triggers a user-initiated sync, which bypasses the foreground gate', async () => {
      const msg = await act('trigger_sync');

      expect(requestSync).toHaveBeenCalledWith('user');
      expect(resultFor(msg.id)?.success).toBe(true);
    });

    it('refreshes exams on demand', async () => {
      const msg = await act('refresh_exams');

      expect(refreshExams).toHaveBeenCalledTimes(1);
      expect(resultFor(msg.id)?.success).toBe(true);
    });
  });

  describe('document download', () => {
    it('passes the fallback URL through, so the unsealed copy is reachable', async () => {
      downloadDocumentInPage.mockResolvedValue({ usedFallback: true });

      const msg = await act('download_document', {
        url: 'https://is.mendelu.cz/auth/dok.pl?id=1',
        filename: 'zadani.pdf',
        fallbackUrl: 'https://is.mendelu.cz/auth/dok.pl?id=1&fallback=1',
      });

      expect(downloadDocumentInPage).toHaveBeenCalledWith(
        'https://is.mendelu.cz/auth/dok.pl?id=1',
        'zadani.pdf',
        'https://is.mendelu.cz/auth/dok.pl?id=1&fallback=1'
      );
      // usedFallback must survive to the iframe: the student is getting a
      // DIFFERENT document from the one they asked for and has to be told.
      expect(resultFor(msg.id)).toMatchObject({ success: true });
    });

    it('refuses a request missing its url or filename', async () => {
      const msg = await act('download_document', { url: 'https://is.mendelu.cz/x' });

      expect(downloadDocumentInPage).not.toHaveBeenCalled();
      expect(resultFor(msg.id)?.success).toBe(false);
    });

    it('does NOT navigate away on an ordinary download failure', async () => {
      // A transient IS 5xx must leave a still-logged-in student where they are;
      // the row shows an error instead. Force-navigating would discard whatever
      // else they had open.
      downloadDocumentInPage.mockRejectedValue(new Error('IS 502'));

      const msg = await act('download_document', { url: 'https://is/x', filename: 'a.pdf' });

      expect(window.location.href).not.toContain('login.pl');
      expect(resultFor(msg.id)?.success).toBe(false);
    });
  });

  describe('notes and Drive backup', () => {
    it('pushes the snapshot AND runs the backup', async () => {
      // Storing the snapshot without running the backup is the silent failure
      // here: the student sees notes saved locally and nothing ever reaches Drive.
      const snapshot = { 'EBC-OS': { f1: { note: 'text', fileName: 'a.pdf' } } };

      const msg = await act('push_notes', snapshot);

      expect(setNotesSnapshot).toHaveBeenCalledWith(snapshot);
      expect(runNotesBackupNow).toHaveBeenCalledTimes(1);
      expect(resultFor(msg.id)?.success).toBe(true);
    });

    // REGRESSION: 'push_notes_html' was absent from the Zod action enum while
    // createNotesSlice.ts sent it and messageHandler implemented a case for it.
    // Every message was therefore dropped at the trust boundary, the HTML
    // override was never cached, and the notes backup silently uploaded the
    // text-only rendering -- formatted notes and their images never reached
    // Drive. This test is what caught it: it could not be made to pass.
    it('caches note HTML WITHOUT triggering a backup', async () => {
      // Deliberately cache-only: this arrives immediately before push_notes,
      // which is the single backup trigger. Backing up here as well would race
      // the snapshot's text-only pass and lose to the hash diff.
      const msg = await act('push_notes_html', { code: 'EBC-OS', html: '<p>hi</p>' });

      expect(setNotesHtmlOverride).toHaveBeenCalledWith('EBC-OS', '<p>hi</p>');
      expect(runNotesBackupNow).not.toHaveBeenCalled();
      expect(resultFor(msg.id)?.success).toBe(true);
    });

    it('runs a Drive backup on demand', async () => {
      const msg = await act('trigger_drive_backup');

      expect(runDriveBackupNow).toHaveBeenCalledTimes(1);
      expect(resultFor(msg.id)?.success).toBe(true);
    });

    it('reports a failed backup rather than claiming it saved', async () => {
      runDriveBackupNow.mockRejectedValue(new Error('drive quota'));

      const msg = await act('trigger_drive_backup');

      expect(resultFor(msg.id)).toMatchObject({
        success: false,
        error: expect.stringContaining('drive quota'),
      });
    });
  });

  describe('logout', () => {
    it('refuses when the page is not an authenticated session', async () => {
      // Outside /auth/ there is no session to end, and submitting the form would
      // just bounce the student somewhere confusing.
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, pathname: '/public/index.pl' },
      });

      const msg = await act('logout');

      expect(resultFor(msg.id)?.data).toMatchObject({
        success: false,
        reason: 'not_authenticated',
      });
    });

    it("clicks IS's own logout button when the page already has the form", async () => {
      // Reusing the real form carries whatever hidden fields IS put in it; a
      // hand-built POST would drop them.
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, pathname: '/auth/index.pl' },
      });
      document.body.innerHTML =
        '<form action="/auth/system/logout.pl"><input name="odhlaseni" type="submit"></form>';
      const button = document.querySelector('input[name="odhlaseni"]') as HTMLInputElement;
      const click = vi.spyOn(button, 'click').mockImplementation(() => {});

      const msg = await act('logout');

      expect(click).toHaveBeenCalledTimes(1);
      expect(resultFor(msg.id)?.success).toBe(true);
      document.body.innerHTML = '';
    });

    it('builds and submits a form when the page has none', async () => {
      Object.defineProperty(window, 'location', {
        configurable: true,
        value: { ...realLocation, pathname: '/auth/index.pl' },
      });
      document.body.innerHTML = '';
      const submit = vi.spyOn(HTMLFormElement.prototype, 'submit').mockImplementation(() => {});

      const msg = await act('logout');

      expect(submit).toHaveBeenCalledTimes(1);
      const form = document.querySelector('form[action="/auth/system/logout.pl"]');
      expect(form).not.toBeNull();
      expect(form!.querySelector('input[name="odhlaseni"]')).not.toBeNull();
      expect(resultFor(msg.id)?.success).toBe(true);
      submit.mockRestore();
      document.body.innerHTML = '';
    });
  });

  it('drops an unknown action at the schema, before the dispatcher sees it', async () => {
    // handleAction has a `default: throw new Error('Unknown action')`, but it is
    // unreachable from here by design: the Zod validator only admits the known
    // action names, so an invented one is discarded with the rest of the
    // malformed traffic and never reaches the switch. Asserting the throw would
    // document a path that cannot be taken; the guarantee worth pinning is that
    // nothing happens and nothing is answered.
    const msg = await act('not_a_real_action');

    expect(resultFor(msg.id)).toBeUndefined();
    expect(registerExam).not.toHaveBeenCalled();
    expect(requestSync).not.toHaveBeenCalled();
  });
});
