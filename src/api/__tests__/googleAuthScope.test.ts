/**
 * CLAUDE.md states the OAuth scope prohibition in absolute terms: "Never escalate
 * the OAuth scope past `drive.file` — not to `drive`, `drive.readonly`, or
 * `documents`." Nothing enforced it. A one-word edit to the scope constant would
 * have shipped a build asking every student for read access to their ENTIRE
 * Google Drive, and no test, lint rule or type would have objected.
 *
 * `drive.file` grants access only to files this app itself created. `drive` is
 * the whole account. They differ by one path segment in one string, which is
 * exactly the kind of change that survives review.
 *
 * These tests pin the string that actually reaches Google's consent screen — the
 * URL handed to launchWebAuthFlow — not the constant, because reading the
 * constant back would pass even if the URL were built from something else.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMessage = vi.hoisted(() => vi.fn());

vi.mock('@/services/storage', () => ({
  IndexedDBService: { get: vi.fn(), set: vi.fn(), delete: vi.fn() },
  STORAGE_KEYS: {},
}));

/** The consent URL connectGoogle asked the background worker to open. */
async function consentUrl(): Promise<URL> {
  const { connectGoogle } = await import('../googleAuth');
  await connectGoogle().catch(() => {
    /* the flow is abandoned after the URL is built; that is all we need */
  });
  const call = sendMessage.mock.calls.find(
    (c) => (c[0] as { type?: string })?.type === 'GOOGLE_LAUNCH_WEB_AUTH_FLOW'
  );
  expect(call, 'connectGoogle never asked to launch the auth flow').toBeDefined();
  return new URL((call![0] as { url: string }).url);
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.stubGlobal('chrome', {
    runtime: {
      sendMessage,
      getURL: () => 'chrome-extension://abc/',
      id: 'abc',
    },
  });
  // The redirect-URL lookup must succeed — connectGoogle needs it BEFORE it
  // builds the consent URL. The flow itself is then denied: these assertions are
  // about the request that goes out, not the response that comes back.
  sendMessage.mockImplementation(async (msg: { type: string }) => {
    if (msg.type === 'GOOGLE_GET_REDIRECT_URL') {
      return { success: true, url: 'https://abc.chromiumapp.org/' };
    }
    return { success: false, error: 'test: flow not completed' };
  });
});

describe('Google OAuth scope', () => {
  it('requests drive.file and nothing wider', async () => {
    const url = await consentUrl();

    expect(url.searchParams.get('scope')).toBe('https://www.googleapis.com/auth/drive.file');
  });

  it('never requests full Drive, read-only Drive, or Docs', async () => {
    const scope = (await consentUrl()).searchParams.get('scope') ?? '';

    // Checked as whole space-separated entries: 'drive.file' contains the
    // substring 'drive', so a substring test would either misfire or be
    // weakened into uselessness.
    const scopes = scope.split(/\s+/).filter(Boolean);
    expect(scopes).not.toContain('https://www.googleapis.com/auth/drive');
    expect(scopes).not.toContain('https://www.googleapis.com/auth/drive.readonly');
    expect(scopes).not.toContain('https://www.googleapis.com/auth/drive.appdata');
    expect(scopes).not.toContain('https://www.googleapis.com/auth/documents');
  });

  it('asks for exactly one scope', async () => {
    // Escalation by addition rather than replacement: appending a second scope
    // leaves the drive.file assertion above passing.
    const scopes = ((await consentUrl()).searchParams.get('scope') ?? '')
      .split(/\s+/)
      .filter(Boolean);

    expect(scopes).toHaveLength(1);
  });

  it('goes to the real Google consent endpoint', async () => {
    const url = await consentUrl();

    expect(url.origin).toBe('https://accounts.google.com');
  });

  it('uses PKCE with S256, never a plain challenge', async () => {
    // The verifier is generated in the page; a `plain` challenge would put it on
    // the wire in the authorization request.
    const url = await consentUrl();

    expect(url.searchParams.get('code_challenge_method')).toBe('S256');
    expect(url.searchParams.get('code_challenge')).toBeTruthy();
    expect(url.searchParams.get('response_type')).toBe('code');
  });

  it('does not put a client secret in the authorization request', async () => {
    // This is a public client: it has no secret, and anything named like one
    // appearing here would be readable by anyone who opens the consent screen.
    const url = await consentUrl();

    expect(url.searchParams.get('client_secret')).toBeNull();
    expect(url.search).not.toMatch(/secret/i);
  });
});
