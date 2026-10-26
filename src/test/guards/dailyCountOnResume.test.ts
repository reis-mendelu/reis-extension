import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

// The daily count runs on RESUME in the Capacitor app, not only at boot.
// A Capacitor process lives in the background for days, and the count used to
// be filed once per cold start, so a student who switched back to reIS every
// morning was counted only on the day iOS last killed the app. The extension
// needs no equivalent: its iframe is rebuilt on every IS page load, and each
// load boots the store, which counts. trackDailyUsage itself writes at most
// once per Prague day, so calling it on every resume is cheap.
// Same shape as menuResumeRefreshIsCapacitorOnly.test.ts.
const STARTAPP = 'capacitor/startApp.ts';

describe('the daily count also runs when the app returns from the background', () => {
  it('capacitor/startApp.ts calls trackDailyUsage inside its resume handler', () => {
    const src = readFileSync(STARTAPP, 'utf8');
    const start = src.indexOf("CapApp.addListener('resume'");
    expect(start, 'the resume listener is gone').toBeGreaterThan(-1);
    const end = src.indexOf('\n  });', start);
    expect(end).toBeGreaterThan(start);
    expect(src.slice(start, end)).toMatch(/\btrackDailyUsage\(\)/);
  });
});
