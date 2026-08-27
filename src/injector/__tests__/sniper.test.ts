/**
 * The decision of WHICH IS pages reIS takes over.
 *
 * injectIframe wipes document.body and document.head — it does not embed
 * alongside the page, it replaces it. So this gate is the difference between
 * "reIS opened" and "the page the student navigated to disappeared". Two cases
 * matter most and neither is recoverable by the student:
 *
 *   - a deep IS page (a syllabus, a form mid-fill) must be left alone
 *   - the LOGIN page must be left alone, or there is no way back in
 *
 * content.ts hides documentElement at document_start to prevent a flash of the
 * raw page, so every non-injecting path must un-hide it. A miss there is a blank
 * white screen, not a visible IS page.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
// The real constant, not a literal — a hardcoded id silently stops matching the
// moment it changes, and the idempotence test would pass by never finding it.
import { IFRAME_ID } from '../config';

const injectIframe = vi.hoisted(() => vi.fn());
const sendToIframe = vi.hoisted(() => vi.fn());
const startSyncService = vi.hoisted(() => vi.fn());
const handleMessage = vi.hoisted(() => vi.fn());
const scrapeNavMenu = vi.hoisted(() => vi.fn());
const fetchOtherLanguage = vi.hoisted(() => vi.fn());
const mergeDual = vi.hoisted(() => vi.fn());

vi.mock('../iframeManager', () => ({ injectIframe, sendToIframe, iframeElement: null }));
vi.mock('../messageHandler', () => ({ handleMessage }));
vi.mock('../syncGate', () => ({ startSyncService }));
vi.mock('../menuScraper', () => ({ scrapeNavMenu, fetchOtherLanguage, mergeDual }));

const realLocation = window.location;

/** Load sniper fresh at a given IS path — its "registered" flag is module state. */
async function atPath(pathname: string) {
  vi.resetModules();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { ...realLocation, pathname },
  });
  return import('../sniper');
}

beforeEach(() => {
  vi.clearAllMocks();
  document.body.innerHTML = '';
  document.documentElement.style.visibility = 'hidden';
  scrapeNavMenu.mockReturnValue(null);
  fetchOtherLanguage.mockResolvedValue(null);
  mergeDual.mockReturnValue([]);
});

describe('pages reIS takes over', () => {
  it.each(['/', '/index.pl', '/auth/', '/auth/index.pl'])('injects on %s', async (path) => {
    const s = await atPath(path);

    s.startInjection();

    expect(injectIframe).toHaveBeenCalledTimes(1);
    expect(startSyncService).toHaveBeenCalledTimes(1);
  });
});

describe('pages reIS leaves alone', () => {
  it.each([
    '/auth/student/studium.pl',
    '/auth/dok_server/slozka.pl',
    '/lide/clovek.pl',
    '/system/login.pl',
  ])('does not inject on %s', async (path) => {
    const s = await atPath(path);

    s.startInjection();

    expect(injectIframe).not.toHaveBeenCalled();
    expect(startSyncService).not.toHaveBeenCalled();
  });

  it('reveals the page it declined to replace', async () => {
    // Without this the student is left staring at the hidden document —
    // a blank screen where an ordinary IS page should be.
    const s = await atPath('/auth/student/studium.pl');

    s.startInjection();

    expect(document.documentElement.style.visibility).toBe('visible');
  });

  it('leaves the LOGIN page alone even at an injectable path', async () => {
    // IS serves the login form at /auth/ when the session has lapsed. Replacing
    // it locks the student out of the system entirely: no form, no way back.
    const s = await atPath('/auth/');
    document.body.innerHTML = '<form action="/system/login.pl"><input name="credential"></form>';

    s.startInjection();

    expect(injectIframe).not.toHaveBeenCalled();
    expect(document.documentElement.style.visibility).toBe('visible');
  });
});

describe('idempotence', () => {
  it('does nothing when the iframe is already present', async () => {
    // startInjection runs again on SPA-ish navigations; a second injection would
    // wipe the mounted app and restart the whole sync.
    const s = await atPath('/auth/');
    const existing = document.createElement('iframe');
    existing.id = IFRAME_ID;
    document.body.appendChild(existing);

    s.startInjection();

    expect(injectIframe).not.toHaveBeenCalled();
  });

  it('registers the message listener only once across repeated injections', async () => {
    const s = await atPath('/auth/');
    const addListener = vi.spyOn(window, 'addEventListener');

    s.startInjection();
    document.body.innerHTML = '';
    s.startInjection();

    const messageRegistrations = addListener.mock.calls.filter(
      (c) => c[0] === 'message' && c[1] === handleMessage
    );
    expect(messageRegistrations).toHaveLength(1);
    addListener.mockRestore();
  });
});

describe('nav menu scraping', () => {
  it('publishes the single-language menu immediately, then the merged one', async () => {
    // The menu is only in the host DOM, and it is the student's whole navigation.
    // Waiting for the second language before showing anything would leave the
    // sidebar empty for the length of a network round trip.
    scrapeNavMenu.mockReturnValue({ categories: [{ id: 'c' }], lang: 'cz' });
    mergeDual.mockReturnValueOnce(['cz-only']).mockReturnValueOnce(['merged']);
    fetchOtherLanguage.mockResolvedValue([{ id: 'c-en' }]);

    const s = await atPath('/auth/');
    s.startInjection();

    expect(s.scrapedNavMenu).toEqual(['cz-only']);

    await vi.waitFor(() => expect(sendToIframe).toHaveBeenCalled());
    expect(s.scrapedNavMenu).toEqual(['merged']);
  });

  it('still injects when the menu cannot be scraped', async () => {
    // A missing menu is a degraded sidebar, not a reason to abandon the app.
    scrapeNavMenu.mockReturnValue(null);

    const s = await atPath('/auth/');
    s.startInjection();

    expect(injectIframe).toHaveBeenCalledTimes(1);
    expect(s.scrapedNavMenu).toBeNull();
  });
});
