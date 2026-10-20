import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

type Listener = () => void;

function fakeBrowser(granted: boolean) {
  const added: Listener[] = [];
  const removed: Listener[] = [];
  const permissions = {
    contains: vi.fn(async () => granted),
    request: vi.fn(async () => true),
    onAdded: { addListener: (cb: Listener) => added.push(cb) },
    onRemoved: { addListener: (cb: Listener) => removed.push(cb) },
  };
  (globalThis as { browser?: unknown }).browser = { permissions };
  return {
    permissions,
    grant: () => {
      granted = true;
      added.forEach((cb) => cb());
    },
    revoke: () => {
      granted = false;
      removed.forEach((cb) => cb());
    },
  };
}

async function load() {
  vi.resetModules();
  return import('../osmTileAccess');
}

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('osmTileAccess', () => {
  beforeEach(() => {
    delete (globalThis as { browser?: unknown }).browser;
  });
  afterEach(() => {
    delete (globalThis as { browser?: unknown }).browser;
  });

  it('is unsupported where there is no permissions API (the apps, the dev webapp)', async () => {
    const m = await load();
    const stop = m.subscribeOsmTileAccess(() => {});
    await settle();
    expect(m.getOsmTileAccess()).toBe('unsupported');
    stop();
  });

  it('is missing when the browser has not granted the OSM tile host', async () => {
    const b = fakeBrowser(false);
    const m = await load();
    const stop = m.subscribeOsmTileAccess(() => {});
    await settle();
    expect(m.getOsmTileAccess()).toBe('missing');
    expect(b.permissions.contains).toHaveBeenCalledWith({
      origins: ['https://tile.openstreetmap.org/*'],
    });
    stop();
  });

  it('is granted when it has', async () => {
    fakeBrowser(true);
    const m = await load();
    const stop = m.subscribeOsmTileAccess(() => {});
    await settle();
    expect(m.getOsmTileAccess()).toBe('granted');
    stop();
  });

  it('follows a grant or revoke made elsewhere (about:addons)', async () => {
    const b = fakeBrowser(false);
    const m = await load();
    const seen = vi.fn();
    const stop = m.subscribeOsmTileAccess(seen);
    await settle();
    b.grant();
    await settle();
    expect(m.getOsmTileAccess()).toBe('granted');
    b.revoke();
    await settle();
    expect(m.getOsmTileAccess()).toBe('missing');
    expect(seen).toHaveBeenCalled();
    stop();
  });

  it('asks for exactly the tile host, synchronously, so Firefox still sees the click', async () => {
    const b = fakeBrowser(false);
    const m = await load();
    void m.requestOsmTileAccess();
    // No await before this line: the request must already have been made.
    expect(b.permissions.request).toHaveBeenCalledWith({
      origins: ['https://tile.openstreetmap.org/*'],
    });
  });

  it('reports a refused or failed request as not granted', async () => {
    const b = fakeBrowser(false);
    b.permissions.request.mockRejectedValueOnce(new Error('not user input'));
    const m = await load();
    await expect(m.requestOsmTileAccess()).resolves.toBe(false);
  });
});
