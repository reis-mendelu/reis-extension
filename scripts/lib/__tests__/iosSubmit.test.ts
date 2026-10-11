import { describe, expect, it } from 'vitest';
import type { AscBody, AscHttp } from '../ascJson';
import { submitIosVersion, submittedVersionState } from '../iosSubmit';

type Call = { method: string; path: string; body?: unknown };

/** A tiny App Store Connect: routes by "METHOD path-prefix", records every call. */
function fakeAsc(routes: Record<string, unknown | ((c: Call) => unknown)>) {
  const calls: Call[] = [];
  const asc: AscHttp = async (method, path, body) => {
    const call = { method, path, body };
    calls.push(call);
    const key = Object.keys(routes).find((k) => `${method} ${path}`.startsWith(k));
    if (!key) throw new Error(`unexpected ${method} ${path}`);
    const r = routes[key];
    const data = typeof r === 'function' ? (r as (c: Call) => unknown)(call) : r;
    return { status: 200, data: data as AscBody };
  };
  return { asc, calls };
}

const build = { data: [{ id: 'B1', attributes: { version: '50401', processingState: 'VALID' } }] };
const versions = (rows: Array<[string, string, string]>) => ({
  data: rows.map(([id, versionString, appStoreState]) => ({
    id,
    attributes: { versionString, appStoreState },
  })),
});
const base = {
  appId: 'APP',
  version: '5.4.1',
  notes: 'Rozvrh je znovu jen po dnech.',
  sleep: async () => {},
};

describe('submitIosVersion', () => {
  it('creates the version, files the notes, attaches the build, reads it back, submits', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V0', '5.4.0', 'READY_FOR_SALE']]),
      'POST /v1/appStoreVersions': { data: { id: 'V1' } },
      'GET /v1/appStoreVersions/V1/appStoreVersionLocalizations': {
        data: [{ id: 'L1', attributes: { locale: 'cs' } }],
      },
      'PATCH /v1/appStoreVersionLocalizations/L1': { data: { id: 'L1' } },
      'PATCH /v1/appStoreVersions/V1/relationships/build': {},
      'GET /v1/appStoreVersions/V1/build': { data: { id: 'B1' } },
      'GET /v1/reviewSubmissions?': { data: [] },
      'POST /v1/reviewSubmissions': { data: { id: 'R1' } },
      'GET /v1/reviewSubmissions/R1/items': { data: [] },
      'POST /v1/reviewSubmissionItems': { data: { id: 'I1' } },
      'PATCH /v1/reviewSubmissions/R1': { data: { attributes: { state: 'WAITING_FOR_REVIEW' } } },
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: false });
    expect(out.status).toBe('submitted');
    const notes = calls.find((c) => c.path.startsWith('/v1/appStoreVersionLocalizations/L1'));
    expect(JSON.stringify(notes?.body)).toContain('Rozvrh je znovu jen po dnech.');
    expect(calls.at(-1)?.method).toBe('PATCH');
  });

  it('refuses when a DIFFERENT version is already waiting, and names it', async () => {
    const { asc } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V9', '5.4.0', 'WAITING_FOR_REVIEW']]),
    });
    await expect(submitIosVersion({ ...base, asc, dryRun: false })).rejects.toThrow(
      /5\.4\.0.*WAITING_FOR_REVIEW/
    );
  });

  it('is a no-op success when this version is already waiting for review (a re-run)', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V1', '5.4.1', 'WAITING_FOR_REVIEW']]),
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: false });
    expect(out.status).toBe('already-submitted');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('a dry run reads and validates but never writes', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V0', '5.4.0', 'READY_FOR_SALE']]),
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: true });
    expect(out.status).toBe('dry-run-ok');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('fails when the build never becomes VALID', async () => {
    const { asc } = fakeAsc({
      'GET /v1/builds': {
        data: [{ id: 'B1', attributes: { version: '50401', processingState: 'PROCESSING' } }],
      },
    });
    await expect(submitIosVersion({ ...base, asc, dryRun: true, maxPolls: 2 })).rejects.toThrow(
      /PROCESSING/
    );
  });

  it('fails when no build exists for the version at all', async () => {
    const { asc } = fakeAsc({ 'GET /v1/builds': { data: [] } });
    await expect(submitIosVersion({ ...base, asc, dryRun: false, maxPolls: 1 })).rejects.toThrow(
      /No build/
    );
  });

  it('a dry run with no build yet is fine: PR dry-runs happen before any upload', async () => {
    const { asc, calls } = fakeAsc({ 'GET /v1/builds': { data: [] } });
    const out = await submitIosVersion({ ...base, asc, dryRun: true });
    expect(out.status).toBe('dry-run-ok');
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it('refuses when the attached build is not the one just uploaded', async () => {
    const { asc } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([]),
      'POST /v1/appStoreVersions': { data: { id: 'V1' } },
      'GET /v1/appStoreVersions/V1/appStoreVersionLocalizations': {
        data: [{ id: 'L1', attributes: { locale: 'cs' } }],
      },
      'PATCH /v1/appStoreVersionLocalizations/L1': {},
      'PATCH /v1/appStoreVersions/V1/relationships/build': {},
      'GET /v1/appStoreVersions/V1/build': { data: { id: 'STALE' } },
    });
    await expect(submitIosVersion({ ...base, asc, dryRun: false })).rejects.toThrow(/STALE/);
  });

  it('does not add the review item again when a dead run already added it', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V1', '5.4.1', 'PREPARE_FOR_SUBMISSION']]),
      'GET /v1/appStoreVersions/V1/appStoreVersionLocalizations': {
        data: [{ id: 'L1', attributes: { locale: 'cs' } }],
      },
      'PATCH /v1/appStoreVersionLocalizations/L1': {},
      'PATCH /v1/appStoreVersions/V1/relationships/build': {},
      'GET /v1/appStoreVersions/V1/build': { data: { id: 'B1' } },
      'GET /v1/reviewSubmissions?': { data: [{ id: 'R1' }] },
      'GET /v1/reviewSubmissions/R1/items': {
        data: [{ id: 'I1', relationships: { appStoreVersion: { data: { id: 'V1' } } } }],
      },
      'PATCH /v1/reviewSubmissions/R1': { data: { attributes: { state: 'WAITING_FOR_REVIEW' } } },
    });
    const out = await submitIosVersion({ ...base, asc, dryRun: false });
    expect(out.status).toBe('submitted');
    expect(calls.some((c) => c.path.startsWith('/v1/reviewSubmissionItems'))).toBe(false);
  });

  it('refuses to submit a review submission that also holds something else', async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/builds': build,
      'GET /v1/apps/APP/appStoreVersions': versions([['V1', '5.4.1', 'PREPARE_FOR_SUBMISSION']]),
      'GET /v1/appStoreVersions/V1/appStoreVersionLocalizations': {
        data: [{ id: 'L1', attributes: { locale: 'cs' } }],
      },
      'PATCH /v1/appStoreVersionLocalizations/L1': {},
      'PATCH /v1/appStoreVersions/V1/relationships/build': {},
      'GET /v1/appStoreVersions/V1/build': { data: { id: 'B1' } },
      'GET /v1/reviewSubmissions?': { data: [{ id: 'R1' }] },
      'GET /v1/reviewSubmissions/R1/items': {
        data: [{ id: 'I9', relationships: { appStoreVersion: { data: { id: 'OTHER' } } } }],
      },
    });
    await expect(submitIosVersion({ ...base, asc, dryRun: false })).rejects.toThrow(/not 5\.4\.1/);
    expect(calls.some((c) => c.method === 'PATCH' && c.path === '/v1/reviewSubmissions/R1')).toBe(
      false
    );
  });
});

describe('versions list pagination', () => {
  it.each(['PROCESSING_FOR_APP_STORE', 'REPLACED_WITH_NEW_VERSION'])(
    'counts %s as already submitted',
    async (state) => {
      const { asc } = fakeAsc({
        'GET /v1/apps/APP/appStoreVersions': versions([['V1', '5.4.1', state]]),
      });
      expect(await submittedVersionState(asc, 'APP', '5.4.1')).toBe(state);
    }
  );

  it('stops instead of looping when ASC repeats the same next link', async () => {
    const page = {
      ...versions([['V0', '5.4.0', 'READY_FOR_SALE']]),
      links: { next: 'https://api.appstoreconnect.apple.com/v1/apps/APP/appStoreVersions?page=2' },
    };
    const { asc } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions?filter': page,
      'GET /v1/apps/APP/appStoreVersions?page=2': page,
    });
    await expect(submittedVersionState(asc, 'APP', '5.4.1')).rejects.toThrow(/repeated/);
  });

  it('follows links.next, so a version beyond the first page is still found', async () => {
    const { asc } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions?': (() => {
        let page = 0;
        return () =>
          page++ === 0
            ? {
                ...versions([['V0', '5.4.0', 'READY_FOR_SALE']]),
                links: {
                  next: 'https://api.appstoreconnect.apple.com/v1/apps/APP/appStoreVersions?page=2',
                },
              }
            : versions([['V1', '5.4.1', 'WAITING_FOR_REVIEW']]);
      })(),
      'GET /v1/apps/APP/appStoreVersions?page=2': versions([['V1', '5.4.1', 'WAITING_FOR_REVIEW']]),
    });
    expect(await submittedVersionState(asc, 'APP', '5.4.1')).toBe('WAITING_FOR_REVIEW');
  });

  it('is null for a version that holds no submission yet', async () => {
    const { asc } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions': versions([['V1', '5.4.1', 'PREPARE_FOR_SUBMISSION']]),
    });
    expect(await submittedVersionState(asc, 'APP', '5.4.1')).toBeNull();
  });
});
