import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';

// The content-script half of fetchAuthedBytes. readBytesBody.test pins the
// helper and authedBytes.iframe.test pins the iframe half, but neither reaches
// handleFetchRequest — a regression to `response.text()` there would leave both
// green while the eduroam p12 arrived as mangled text.
const ORIGIN = 'chrome-extension://reis-test';
const source = {} as Window;
const sendToIframe = vi.fn();

vi.mock('./iframeManager', () => ({
  iframeElement: { contentWindow: source },
  sendToIframe: (...a: unknown[]) => sendToIframe(...a),
  markIframeReady: vi.fn(),
}));
vi.mock('./syncService', () => ({
  cachedData: {},
  isSyncing: false,
  refreshExams: vi.fn(),
  refreshSchedule: vi.fn(),
}));
vi.mock('./syncGate', () => ({ requestSync: vi.fn() }));
vi.mock('./dataFetchers', () => ({ fetchFullSemesterSchedule: vi.fn() }));
vi.mock('../api/exams', () => ({
  fetchExamData: vi.fn(),
  registerExam: vi.fn(),
  unregisterExam: vi.fn(),
}));
vi.mock('../api/subjects', () => ({ fetchSubjects: vi.fn() }));
vi.mock('./sniper', () => ({ scrapedNavMenu: null }));
vi.mock('./documentDownloader', () => ({ downloadDocumentInPage: vi.fn() }));
vi.mock('./hostSignOut', () => ({ signOutFromHostPage: vi.fn() }));

let handleMessage: (e: MessageEvent) => Promise<void>;

beforeAll(async () => {
  vi.stubGlobal('chrome', { runtime: { getURL: (p: string) => `${ORIGIN}/${p}` } });
  ({ handleMessage } = await import('./messageHandler'));
});

afterEach(() => {
  vi.restoreAllMocks();
  sendToIframe.mockClear();
});

function reisFetch(id: string, url: string) {
  return {
    origin: ORIGIN,
    source,
    data: { type: 'REIS_FETCH', id, url, options: { responseType: 'bytes' } },
  } as unknown as MessageEvent;
}

describe("handleMessage REIS_FETCH responseType 'bytes'", () => {
  it('fetches first-party and replies with the exact bytes as base64', async () => {
    // 0x80–0xFF are invalid UTF-8 on their own: text() would turn them into U+FFFD.
    const bytes = new Uint8Array([0x30, 0x82, 0x04, 0x80, 0xff, 0x00, 0xc3]);
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(
        new Response(bytes, { headers: { 'content-type': 'application/x-pkcs12' } })
      );
    const url = 'https://is.mendelu.cz/auth/wifi/certifikat.pl?get=user-p12;lang=cz';

    await handleMessage(reisFetch('b1', url));

    expect(fetchSpy).toHaveBeenCalledWith(url, expect.objectContaining({ credentials: 'include' }));
    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'REIS_FETCH_RESULT',
        id: 'b1',
        success: true,
        data: 'MIIEgP8Aww==',
      })
    );
  });

  it('replies with a failure, not bytes, when IS answers with a page', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('<html>login</html>', {
        headers: { 'content-type': 'text/html; charset=UTF-8' },
      })
    );

    await handleMessage(
      reisFetch('b2', 'https://is.mendelu.cz/auth/wifi/certifikat.pl?get=root-der')
    );

    expect(sendToIframe).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'REIS_FETCH_RESULT', id: 'b2', success: false })
    );
  });
});
