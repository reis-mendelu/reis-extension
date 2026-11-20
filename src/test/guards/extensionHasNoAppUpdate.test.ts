import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Nová verze reISu" is on the PHONE tree only, on purpose.
 *
 * It exists because a phone can sit on an old build for weeks: 5.6.0 could not
 * read IS's new markup of 15 Nov 2026, the fix had shipped in 5.7.0, and ~230
 * phones still on 5.6.0 lost Předměty with nothing telling them to update
 * (suggestion 46). The browser updates an extension by itself within hours,
 * and there is no store page a tap could open, so the extension's bell has no
 * such row. Both halves are pinned, so a later "reuse the row" does not bring
 * a dead control to the desktop.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('app update prompt placement', () => {
  it.each([
    'components/Notifications/NotificationDropdown.tsx',
    'components/NotificationFeed.tsx',
    'components/Notifications/NotificationRow.tsx',
  ])('the extension bell (%s) has no update row', (file) => {
    expect(read(file)).not.toMatch(/AppUpdateRow|appUpdate/);
  });

  it("the phone's Novinky and bell do", () => {
    expect(read('components/mobile/sheets/NotificationsSheet.tsx')).toContain('<AppUpdateRow />');
    expect(read('components/mobile/screens/HeaderActions.tsx')).toContain('appUpdateSeenId');
  });

  it('only the phone tree and the Capacitor boot import the store plugin wrapper', () => {
    expect(read('components/mobile/sheets/AppUpdateRow.tsx')).toContain('mobile/appUpdate');
    // Dynamic import inside, so @capawesome never enters the extension's graph.
    expect(read('mobile/appUpdate.ts')).not.toMatch(/^import .*@capawesome/m);
  });
});
