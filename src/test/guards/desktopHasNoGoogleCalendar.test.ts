import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * Google Calendar sync is phone/iPad ONLY (Dominik, 2026-10-08: "it should only
 * work for phone, no extension on desktop"; spec
 * docs/superpowers/specs/2026-10-08-google-calendar-sync-design.md).
 *
 * The extension cannot hold a Google grant without a client secret:
 * getAuthToken is Chrome-only, launchWebAuthFlow gives a 1-hour token with no
 * refresh, and a secret needs a relay server — the shape of the Drive backup
 * removed in 27dc1c326. The phone keeps the student's Google calendar current,
 * and that calendar is on every device they own, desktop included.
 *
 * Both halves are pinned so a later "reuse the sheet on desktop" fails here.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

// The tree-parity hook's own resolver (see treeParityHookSees.test.ts for why
// it is imported by URL): it walks the desktop tree's whole import closure, so
// an import added deep inside a child module is caught too, not only one in
// the entry files.
type Hook = {
  DESKTOP_ENTRY: string[];
  MOBILE_ENTRY: string[];
  closure: (entries: string[]) => Set<string>;
};
const hook: Hook = await import(
  /* @vite-ignore */ pathToFileURL(resolve('.claude/hooks/tree-parity.mjs')).href
);

describe('Google Calendar sync placement', () => {
  it.each([
    'src/components/Sidebar.tsx',
    'src/components/AppMain.tsx',
    'src/components/AppOverlays.tsx',
    // Composed into the shared store, so it must stay state only.
    'src/store/slices/createGoogleCalendarSlice.ts',
  ])('%s does not reach src/mobile/googleCalendar', (file) => {
    // An import, not a mention: the slice's own comment names the directory.
    expect(read(file)).not.toMatch(/(?:from|import)\s*\(?\s*['"][^'"]*mobile\/googleCalendar/);
  });

  it('nothing in the desktop import closure is under src/mobile/googleCalendar', () => {
    const desktop = [...hook.closure(hook.DESKTOP_ENTRY)];
    expect(desktop.length).toBeGreaterThan(100); // resolution worked
    expect(desktop.filter((f) => f.includes('mobile/googleCalendar'))).toEqual([]);
    // and the same walk does see them from the phone tree, so the check can fail
    expect(hook.closure(hook.MOBILE_ENTRY)).toContain('src/mobile/googleCalendar/controller.ts');
  });

  it.each([
    // The call, not just the import: removing it would leave the import green.
    ['capacitor/startApp.ts', 'installGoogleCalendarSync()'],
    ['src/components/mobile/screens/ProfileScreen.tsx', "kind: 'googleCalendar'"],
    ['src/components/mobile/sheets/SheetHost.tsx', 'GoogleCalendarSheet'],
  ])('%s still has it', (file, needle) => {
    expect(read(file)).toContain(needle);
  });

  /**
   * Named so the tree-parity Stop hook (.claude/hooks/tree-parity.mjs) clears
   * them: these files are phone/iPad-only by decision, not by omission.
   */
  it.each([
    'src/mobile/googleCalendar/calendarApi.ts',
    'src/mobile/googleCalendar/calendarHttp.ts',
    'src/mobile/googleCalendar/controller.ts',
    'src/mobile/googleCalendar/eventIdentity.ts',
    'src/mobile/googleCalendar/googleCalendarNative.ts',
    'src/mobile/googleCalendar/installGoogleCalendarSync.ts',
    'src/mobile/googleCalendar/normalize.ts',
    'src/mobile/googleCalendar/plan.ts',
    'src/mobile/googleCalendar/pragueDate.ts',
    'src/mobile/googleCalendar/runPool.ts',
    'src/mobile/googleCalendar/runSync.ts',
    'src/mobile/googleCalendar/syncStateStore.ts',
    'src/mobile/googleCalendar/syncTimeLabel.ts',
    'src/mobile/googleCalendar/toGoogleEvent.ts',
    'src/mobile/googleCalendar/types.ts',
    'src/components/mobile/sheets/GoogleCalendarSheet.tsx',
  ])('%s is phone-only', (file) => {
    expect(() => read(file)).not.toThrow();
  });
});
