import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { requestOsmTileAccess, watchOsmTileAccess } from '../osmTileAccess';

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

const settle = () => new Promise((r) => setTimeout(r, 0));

describe('osmTileAccess', () => {
  beforeEach(() => {
    delete (globalThis as { browser?: unknown }).browser;
  });
  afterEach(() => {
    delete (globalThis as { browser?: unknown }).browser;
  });

  it('is unsupported where there is no permissions API (the apps, the dev webapp)', async () => {
    const seen = vi.fn();
    watchOsmTileAccess(seen);
    await settle();
    expect(seen).toHaveBeenLastCalledWith('unsupported');
  });

  it('is missing when the browser has not granted the OSM tile host', async () => {
    const b = fakeBrowser(false);
    const seen = vi.fn();
    watchOsmTileAccess(seen);
    await settle();
    expect(seen).toHaveBeenLastCalledWith('missing');
    expect(b.permissions.contains).toHaveBeenCalledWith({
      origins: ['https://tile.openstreetmap.org/*'],
    });
  });

  it('is granted when it has', async () => {
    fakeBrowser(true);
    const seen = vi.fn();
    watchOsmTileAccess(seen);
    await settle();
    expect(seen).toHaveBeenLastCalledWith('granted');
  });

  it('follows a grant or revoke made elsewhere (about:addons)', async () => {
    const b = fakeBrowser(false);
    const seen = vi.fn();
    watchOsmTileAccess(seen);
    await settle();
    b.grant();
    await settle();
    expect(seen).toHaveBeenLastCalledWith('granted');
    b.revoke();
    await settle();
    expect(seen).toHaveBeenLastCalledWith('missing');
  });

  it('asks for exactly the tile host, synchronously, so Firefox still sees the click', () => {
    const b = fakeBrowser(false);
    void requestOsmTileAccess();
    // No await before this line: the request must already have been made.
    expect(b.permissions.request).toHaveBeenCalledWith({
      origins: ['https://tile.openstreetmap.org/*'],
    });
  });

  it('reports a refused or failed request as not granted', async () => {
    const b = fakeBrowser(false);
    b.permissions.request.mockRejectedValueOnce(new Error('not user input'));
    await expect(requestOsmTileAccess()).resolves.toBe(false);
  });
});
