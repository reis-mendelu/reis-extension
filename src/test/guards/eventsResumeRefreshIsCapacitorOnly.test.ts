import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// Events reload on RESUME only in the Capacitor app. The extension needs no
// equivalent: its iframe is rebuilt on every IS page load, so it fetches fresh
// events each time. Named paths clear the tree-parity hook for these files.
describe('events refresh on resume is Capacitor-only, on purpose', () => {
  it('capacitor/startApp.ts refreshes map events on resume', () => {
    const src = readFileSync('capacitor/startApp.ts', 'utf8');
    expect(src).toMatch(/addListener\('resume'[\s\S]*refreshMapEventsIfStale/);
  });
});
