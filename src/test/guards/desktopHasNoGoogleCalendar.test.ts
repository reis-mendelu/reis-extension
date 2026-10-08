import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
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

  it.each([
    ['capacitor/startApp.ts', 'installGoogleCalendarSync'],
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
