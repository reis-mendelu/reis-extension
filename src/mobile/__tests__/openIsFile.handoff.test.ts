import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * When the row's download indicator may stop. Not when the bytes land: on a
 * phone that is the START of the slow part — the base64 round trip, the write
 * to disk, and on Android `Downloads.save` — and a row that looked idle through
 * it while its lock silently refused every tap read as a dead button, so the
 * student hammered it (Task List, 2026-10-20). It stops when the student has
 * something else to look at: iOS's share sheet, or Android's finished save.
 */

const order: string[] = [];
const deferred = () => {
  let resolve: (v?: unknown) => void = () => {};
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
};
let gates: Record<'base64' | 'write' | 'save', ReturnType<typeof deferred>>;
let platform: 'ios' | 'android' = 'ios';

vi.mock('@capacitor/core', () => ({
  registerPlugin: () => ({
    save: vi.fn(async () => {
      order.push('save:start');
      await gates.save.promise;
      order.push('save:done');
      return { uri: 'content://x', bytes: 3 };
    }),
    requestNotificationPermission: vi.fn(async () => ({ granted: true })),
  }),
  Capacitor: { getPlatform: () => platform },
  CapacitorHttp: { get: vi.fn() },
  CapacitorCookies: { setCookie: vi.fn() },
}));
vi.mock('../../platform', () => ({ getPlatform: () => ({ kind: 'capacitor' }) }));
vi.mock('../../platform/tokenStore', () => ({ loadStoredToken: vi.fn(async () => 'tok') }));
vi.mock('../../api/isDocumentUrl', () => ({ toDirectDownloadUrl: () => null }));
vi.mock('../../api/capacitorBinary', () => ({
  fetchIsBinary: vi.fn(async () => {
    order.push('fetched');
    return {
      kind: 'binary',
      blob: new Blob(['abc'], { type: 'application/pdf' }),
      filename: 'a.pptx',
    };
  }),
  blobToBase64: vi.fn(async () => {
    await gates.base64.promise;
    order.push('base64');
    return 'YWJj';
  }),
}));
vi.mock('@capacitor/filesystem', () => ({
  Directory: { Documents: 'DOCUMENTS' },
  Filesystem: {
    writeFile: vi.fn(async () => {
      await gates.write.promise;
      order.push('written');
    }),
    getUri: vi.fn(async () => ({ uri: 'file:///a.pptx' })),
  },
}));
vi.mock('@capacitor/share', () => ({
  Share: {
    share: vi.fn(async () => {
      order.push('share');
    }),
  },
}));

const { openIsFileNatively } = await import('../openIsFile');

const flush = () => new Promise((r) => setTimeout(r, 0));

describe('openIsFileNatively — when the busy row may go idle', () => {
  beforeEach(() => {
    order.length = 0;
    gates = { base64: deferred(), write: deferred(), save: deferred() };
  });

  it('iOS: stays busy through the base64 and the write, and hands over as the share sheet opens', async () => {
    platform = 'ios';
    const onHandoff = vi.fn(() => order.push('handoff'));
    const done = openIsFileNatively('slozka.pl?download=1', undefined, undefined, onHandoff);

    await flush();
    expect(order).toEqual(['fetched']);
    expect(onHandoff).not.toHaveBeenCalled();

    gates.base64.resolve();
    await flush();
    expect(onHandoff).not.toHaveBeenCalled();

    gates.write.resolve();
    await done;
    expect(order).toEqual(['fetched', 'base64', 'written', 'handoff', 'share']);
  });

  it('Android: stays busy until Downloads.save has finished', async () => {
    platform = 'android';
    const onHandoff = vi.fn(() => order.push('handoff'));
    const done = openIsFileNatively('slozka.pl?download=1', undefined, undefined, onHandoff);

    gates.base64.resolve();
    await flush();
    expect(order).toContain('save:start');
    expect(onHandoff).not.toHaveBeenCalled();

    gates.save.resolve();
    await done;
    expect(order.indexOf('handoff')).toBeGreaterThan(order.indexOf('save:done'));
  });
});
