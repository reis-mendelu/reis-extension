// Minimal `chrome.*` stub so the real reIS iframe app boots at a plain http
// origin (mirrors src/test/setup.ts). Imported first in entry.tsx, before any
// app module, so StorageService/SyncMigration/etc. find chrome.storage.
//
// This exists to run the iframe UI at http://localhost for Chrome MCP debugging
// (claude-in-chrome cannot access a different extension's chrome-extension://
// frame — see docs/superpowers/specs/2026-07-04-mcp-web-origin-iframe-design.md).
const g = globalThis as unknown as { chrome?: Record<string, unknown> };

if (!g.chrome) g.chrome = {};

const mem: Record<string, unknown> = {};
function compute(keys?: unknown): Record<string, unknown> {
  if (keys == null) return { ...mem };
  if (typeof keys === 'string') return { [keys]: mem[keys] };
  if (Array.isArray(keys)) return Object.fromEntries(keys.map(k => [k, mem[k]]));
  return Object.fromEntries(Object.keys(keys as object).map(k => [k, mem[k] ?? (keys as Record<string, unknown>)[k]]));
}
function makeArea() {
  return {
    get: (keys?: unknown, cb?: (r: unknown) => void) => {
      if (typeof keys === 'function') { (keys as (r: unknown) => void)(compute()); return; }
      const res = compute(keys);
      if (typeof cb === 'function') { cb(res); return; }
      return Promise.resolve(res);
    },
    set: (obj: Record<string, unknown>, cb?: () => void) => {
      Object.assign(mem, obj);
      if (typeof cb === 'function') { cb(); return; }
      return Promise.resolve();
    },
    remove: (k: string | string[], cb?: () => void) => {
      (Array.isArray(k) ? k : [k]).forEach(x => delete mem[x]);
      if (typeof cb === 'function') { cb(); return; }
      return Promise.resolve();
    },
    clear: (cb?: () => void) => {
      for (const key of Object.keys(mem)) delete mem[key];
      if (typeof cb === 'function') { cb(); return; }
      return Promise.resolve();
    },
  };
}

if (!g.chrome.storage) {
  const area = makeArea();
  g.chrome.storage = { local: area, sync: area, onChanged: { addListener() {}, removeListener() {} } };
}
if (!g.chrome.runtime) {
  g.chrome.runtime = {
    id: 'dev-iframe',
    getManifest: () => ({ version: '0.0.0' }),
    getURL: (p: string) => '/' + p,
    onMessage: { addListener() {}, removeListener() {} },
    sendMessage: () => Promise.resolve(),
  };
}
