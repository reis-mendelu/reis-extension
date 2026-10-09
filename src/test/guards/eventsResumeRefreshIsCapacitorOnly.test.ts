import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// Events reload on RESUME only in the Capacitor app. The extension needs no
// equivalent: its iframe is rebuilt on every IS page load, so it fetches fresh
// events each time. Both halves are pinned: the Capacitor resume handler makes
// the call, and nothing under src/ (the extension's and the shared code) does,
// so the resume wiring stays in the Capacitor bootstrap.
const STARTAPP = 'capacitor/startApp.ts';
const CALL = /\brefreshMapEventsIfStale\s*\(/;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourcesUnder(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

describe('events refresh on resume is Capacitor-only, on purpose', () => {
  it('capacitor/startApp.ts refreshes map events inside its resume handler', () => {
    const src = readFileSync(STARTAPP, 'utf8');
    const start = src.indexOf("CapApp.addListener('resume'");
    expect(start, 'the resume listener is gone').toBeGreaterThan(-1);
    // The handler's own body only: from the listener to its closing `});`.
    const end = src.indexOf('\n  });', start);
    expect(end, 'the resume handler no longer closes with `  });`').toBeGreaterThan(start);
    const handler = src.slice(start, end);
    expect(handler).toContain('useAppStore.getState().refreshMapEventsIfStale(MIN_SYNC_GAP)');
    // The catalog rides on that refresh: reloadMapEvents loads it beside the
    // events, under the same gap. A separate call here fetched the catalog on
    // every resume, past MIN_SYNC_GAP, and twice when the events were stale.
    expect(handler).not.toMatch(/\bloadSocieties\s*\(/);
  });

  it('nothing the extension ships calls refreshMapEventsIfStale', () => {
    const callers = sourcesUnder(resolve(process.cwd(), 'src')).filter((f) =>
      CALL.test(readFileSync(f, 'utf8'))
    );
    expect(callers).toEqual([]);
  });
});
