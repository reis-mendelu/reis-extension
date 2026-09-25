import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  initDataConsent,
  hasDataConsent,
  requestDataConsent,
  reportConsentCategories,
  __resetDataConsentForTests,
} from '../firefoxDataConsent';

function install(api: unknown) {
  vi.stubGlobal('browser', api === undefined ? undefined : { permissions: api });
}

describe('firefox data consent', () => {
  beforeEach(() => __resetDataConsentForTests());
  afterEach(() => vi.unstubAllGlobals());

  it('allows everything where the browser has no data-consent API (Chrome, the apps)', async () => {
    install({ getAll: vi.fn(async () => ({ permissions: [], origins: [] })), request: vi.fn() });
    await initDataConsent();
    expect(await hasDataConsent('technicalAndInteraction')).toBe(true);
    expect(await requestDataConsent(['websiteContent'])).toBe(true);
  });

  it('allows everything when there is no extension API at all', async () => {
    install(undefined);
    await initDataConsent();
    expect(await hasDataConsent('technicalAndInteraction')).toBe(true);
  });

  it('on Firefox, follows what the user granted', async () => {
    install({
      getAll: vi.fn(async () => ({ data_collection: ['technicalAndInteraction'] })),
      request: vi.fn(),
    });
    await initDataConsent();
    expect(await hasDataConsent('technicalAndInteraction')).toBe(true);
    expect(await hasDataConsent('websiteContent')).toBe(false);
  });

  it('re-reads the grant, because the user can switch it off in about:addons', async () => {
    const getAll = vi
      .fn()
      .mockResolvedValueOnce({ data_collection: ['technicalAndInteraction'] })
      .mockResolvedValueOnce({ data_collection: [] });
    install({ getAll, request: vi.fn() });
    await initDataConsent();
    expect(await hasDataConsent('technicalAndInteraction')).toBe(false);
  });

  it('on Firefox, requests exactly the categories asked for, synchronously', async () => {
    const request = vi.fn(async () => true);
    install({ getAll: vi.fn(async () => ({ data_collection: [] })), request });
    await initDataConsent();
    // The call must reach permissions.request before any await, or Firefox no
    // longer treats it as a user action and rejects it.
    const p = requestDataConsent(['personalCommunications', 'websiteContent']);
    expect(request).toHaveBeenCalledWith({
      data_collection: ['personalCommunications', 'websiteContent'],
    });
    expect(await p).toBe(true);
  });

  it('a declined or failed request means no', async () => {
    install({
      getAll: vi.fn(async () => ({ data_collection: [] })),
      request: vi.fn(async () => false),
    });
    await initDataConsent();
    expect(await requestDataConsent(['personalCommunications'])).toBe(false);
    install({
      getAll: vi.fn(async () => ({ data_collection: [] })),
      request: vi.fn(async () => {
        throw new Error('not a user action');
      }),
    });
    __resetDataConsentForTests();
    await initDataConsent();
    expect(await requestDataConsent(['personalCommunications'])).toBe(false);
  });
});

describe('reportConsentCategories', () => {
  it('always needs the message, and adds what the report carries', () => {
    expect(reportConsentCategories({ contact: '', screenshot: false, diagnostics: false })).toEqual(
      ['personalCommunications']
    );
    expect(
      reportConsentCategories({ contact: 'a@b.cz', screenshot: true, diagnostics: true })
    ).toEqual([
      'personalCommunications',
      'personallyIdentifyingInfo',
      'websiteContent',
      'technicalAndInteraction',
    ]);
  });

  it('a whitespace-only contact is no contact', () => {
    expect(
      reportConsentCategories({ contact: '  ', screenshot: false, diagnostics: false })
    ).toEqual(['personalCommunications']);
  });
});
