// Side-effect module: mcp/server.ts imports it FIRST. src/api/* reads window,
// fetch and IndexedDB at import time, and import declarations hoist.
import 'fake-indexeddb/auto';
import { Window } from 'happy-dom';
import { setPlatform } from '../src/platform/index';
import { createWebPlatform } from '../src/platform/webPlatform';

/** The real fetch, captured before anything replaces it. */
export const nativeFetch: typeof fetch = globalThis.fetch.bind(globalThis);

let current: typeof fetch = nativeFetch;
/** Point the global fetch at the IS session. The global itself is set once, here. */
export function setSessionFetch(f: typeof fetch): void {
  current = f;
}

const win = new Window({ url: 'https://is.mendelu.cz/' });
const g = globalThis as Record<string, unknown>;
const w = win as unknown as Record<string, unknown>;
g.window = win;
g.document = win.document;
g.DOMParser = win.DOMParser;
// Bare DOM constructors some parsers reference (`node instanceof Node`).
for (const name of [
  'Node',
  'NodeList',
  'NodeFilter',
  'Element',
  'HTMLElement',
  'Text',
  'Comment',
  'DocumentFragment',
  'HTMLCollection',
]) {
  if (w[name]) g[name] = w[name];
}
globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) =>
  current(input, init)) as typeof fetch;

// The in-memory web host: fetchWithAuth takes the plain-fetch path, which is the
// session fetch above. Nothing persists between server runs.
setPlatform(createWebPlatform());
