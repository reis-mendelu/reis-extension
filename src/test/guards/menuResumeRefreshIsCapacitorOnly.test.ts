import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';

// The jídelníček gets a second chance on RESUME, in the Capacitor app only.
// The app fetched it once at boot, so a boot fetch that failed (the app started
// while the phone dozed) left no menu and no chef hat for the session, and a
// process alive for days kept last week's menu. The extension needs no
// equivalent: its iframe is rebuilt on every IS page load, which fetches again.
// Same shape as eventsResumeRefreshIsCapacitorOnly.test.ts.
const STARTAPP = 'capacitor/startApp.ts';
const CALL = /\brefreshMenuIfStale\s*\(/;

function sourcesUnder(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourcesUnder(path);
    return /\.tsx?$/.test(name) && !name.includes('.test.') ? [path] : [];
  });
}

describe('menu refresh on resume is Capacitor-only, on purpose', () => {
  it('capacitor/startApp.ts refreshes the menu inside its resume handler', () => {
    const src = readFileSync(STARTAPP, 'utf8');
    const start = src.indexOf("CapApp.addListener('resume'");
    expect(start, 'the resume listener is gone').toBeGreaterThan(-1);
    const end = src.indexOf('\n  });', start);
    expect(end).toBeGreaterThan(start);
    expect(src.slice(start, end)).toContain(
      'useAppStore.getState().refreshMenuIfStale(MIN_SYNC_GAP)'
    );
  });

  it('nothing the extension ships calls refreshMenuIfStale', () => {
    const callers = sourcesUnder(resolve(process.cwd(), 'src')).filter(
      (f) => CALL.test(readFileSync(f, 'utf8')) && !f.endsWith('createMenuSlice.ts')
    );
    expect(callers).toEqual([]);
  });
});
