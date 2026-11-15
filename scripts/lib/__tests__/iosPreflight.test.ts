import { describe, expect, it } from 'vitest';
import type { AscBody, AscHttp } from '../ascJson';
import { describeBlocker, iosBlockers, readOnly } from '../iosPreflight';

type Call = { method: string; path: string };

/** A tiny App Store Connect: routes by "METHOD path-prefix", records every call. */
function fakeAsc(routes: Record<string, unknown>) {
  const calls: Call[] = [];
  const asc: AscHttp = async (method, path) => {
    calls.push({ method, path });
    const key = Object.keys(routes).find((k) => `${method} ${path}`.startsWith(k));
    if (!key) throw new Error(`unexpected ${method} ${path}`);
    return { status: 200, data: routes[key] as AscBody };
  };
  return { asc, calls };
}

const versions = (rows: Array<[string, string, string]>) => ({
  data: rows.map(([id, versionString, appStoreState]) => ({
    id,
    attributes: { versionString, appStoreState },
  })),
});

describe('iosBlockers', () => {
  it('reports the previous version still waiting for review, with its submission id', async () => {
    // The 5.7.2 case: 5.7.1 had only reached review that morning.
    const { asc, calls } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions': versions([
        ['V0', '5.7.0', 'READY_FOR_SALE'],
        ['V1', '5.7.1', 'WAITING_FOR_REVIEW'],
      ]),
      'GET /v1/reviewSubmissions?': { data: [{ id: 'R1' }] },
      'GET /v1/reviewSubmissions/R1/items': {
        data: [{ id: 'I1', relationships: { appStoreVersion: { data: { id: 'V1' } } } }],
      },
    });
    const out = await iosBlockers(asc, 'APP', '5.7.2');
    expect(out).toEqual([
      { id: 'V1', versionString: '5.7.1', state: 'WAITING_FOR_REVIEW', submissionIds: ['R1'] },
    ]);
    expect(describeBlocker(out[0]!)).toBe(
      '5.7.1 is WAITING_FOR_REVIEW (version record V1, review submission R1)'
    );
    // Without include, ASC returns the items with no appStoreVersion relationship.
    expect(calls.some((c) => c.path.includes('/items?include=appStoreVersion'))).toBe(true);
    expect(calls.every((c) => c.method === 'GET')).toBe(true);
  });

  it("leaves out the new version's own draft: ios-submit.ts reuses it", async () => {
    const { asc, calls } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions': versions([
        ['V1', '5.7.1', 'READY_FOR_SALE'],
        ['V2', '5.7.2', 'PREPARE_FOR_SUBMISSION'],
      ]),
    });
    expect(await iosBlockers(asc, 'APP', '5.7.2')).toEqual([]);
    // Nothing in review: no need to look up review submissions.
    expect(calls).toHaveLength(1);
  });

  it('still reports an older rejected version: only one version can be edited', async () => {
    const { asc } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions': versions([
        ['V1', '5.7.1', 'DEVELOPER_REJECTED'],
        ['V2', '5.7.2', 'PREPARE_FOR_SUBMISSION'],
      ]),
    });
    const out = await iosBlockers(asc, 'APP', '5.7.3');
    expect(out.map((b) => `${b.versionString} ${b.state}`)).toEqual([
      '5.7.1 DEVELOPER_REJECTED',
      '5.7.2 PREPARE_FOR_SUBMISSION',
    ]);
  });

  it('reports nothing when every other version is live or replaced', async () => {
    const { asc } = fakeAsc({
      'GET /v1/apps/APP/appStoreVersions': versions([
        ['V0', '5.7.0', 'REPLACED_WITH_NEW_VERSION'],
        ['V1', '5.7.1', 'READY_FOR_SALE'],
      ]),
    });
    expect(await iosBlockers(asc, 'APP', '5.7.2')).toEqual([]);
  });
});

describe('readOnly', () => {
  it('refuses every write, so the preflight cannot change App Store Connect', async () => {
    const { asc, calls } = fakeAsc({ 'GET /v1/x': { data: [] } });
    const ro = readOnly(asc);
    await expect(ro('GET', '/v1/x')).resolves.toBeTruthy();
    await expect(ro('PATCH', '/v1/reviewSubmissions/R1', {})).rejects.toThrow(/read-only/);
    await expect(ro('POST', '/v1/appStoreVersions', {})).rejects.toThrow(/read-only/);
    expect(calls).toEqual([{ method: 'GET', path: '/v1/x' }]);
  });
});
