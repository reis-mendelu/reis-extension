import type { AscBody, AscHttp } from '../ascJson';

/** Shared by iosSubmit*.test.ts. */
export type Call = { method: string; path: string; body?: unknown };

/** A tiny App Store Connect: routes by "METHOD path-prefix", records every call. */
export function fakeAsc(routes: Record<string, unknown | ((c: Call) => unknown)>) {
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

export const build = {
  data: [{ id: 'B1', attributes: { version: '50401', processingState: 'VALID' } }],
};
export const versions = (rows: Array<[string, string, string]>) => ({
  data: rows.map(([id, versionString, appStoreState]) => ({
    id,
    attributes: { versionString, appStoreState },
  })),
});
export const base = {
  appId: 'APP',
  version: '5.4.1',
  notes: 'Rozvrh je znovu jen po dnech.',
  sleep: async () => {},
};
