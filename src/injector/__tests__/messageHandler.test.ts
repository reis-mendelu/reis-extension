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

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Messages } from '../../types/messages';

const sendToIframe = vi.hoisted(() => vi.fn());
const markIframeReady = vi.hoisted(() => vi.fn());
const requestSync = vi.hoisted(() => vi.fn());
const fetchFullSemesterSchedule = vi.hoisted(() => vi.fn());
const fetchExamData = vi.hoisted(() => vi.fn());
const fetchSubjects = vi.hoisted(() => vi.fn());
const isIsMendeluUrl = vi.hoisted(() => vi.fn());

const contentWindow = { name: 'iframe-window' } as unknown as Window;

vi.mock('../iframeManager', () => ({
  iframeElement: { contentWindow },
  sendToIframe,
  markIframeReady,
}));
vi.mock('../syncService', () => ({
  cachedData: { lastSync: 1, files: { CZ: [] } },
  isSyncing: false,
  runDriveBackupNow: vi.fn(),
  runNotesBackupNow: vi.fn(),
  setNotesSnapshot: vi.fn(),
  setNotesHtmlOverride: vi.fn(),
  refreshExams: vi.fn(),
}));
vi.mock('../syncGate', () => ({ requestSync }));
vi.mock('../dataFetchers', () => ({ fetchFullSemesterSchedule }));
vi.mock('../../api/exams', () => ({
  fetchExamData,
  registerExam: vi.fn(),
  unregisterExam: vi.fn(),
}));
vi.mock('../../api/subjects', () => ({ fetchSubjects }));
vi.mock('../sniper', () => ({ scrapedNavMenu: null }));
vi.mock('../documentDownloader', () => ({ downloadDocumentInPage: vi.fn() }));
vi.mock('../isMendeluUrl', () => ({ isIsMendeluUrl }));

const ORIGIN = 'chrome-extension://abcdef';

let handleMessage: (e: MessageEvent) => Promise<void>;

beforeEach(async () => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal('chrome', {
    runtime: { getURL: () => `${ORIGIN}/`, sendMessage: vi.fn() },
  });
  handleMessage = (await import('../messageHandler')).handleMessage;
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
