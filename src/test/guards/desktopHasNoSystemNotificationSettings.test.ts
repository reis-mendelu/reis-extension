import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The phone's "are notifications on?" row and banner are PHONE-ONLY, on purpose.
 *
 * The extension has no system notifications to switch (see
 * desktopHasNoExamSystemNotifications.test.ts: it would need the `notifications`
 * permission and store review, and would fire only while the browser runs), so
 * a row saying "Oznámení v telefonu: Vypnutá" there would describe nothing.
 * Both halves are pinned, so a later "reuse this component" cannot bring it
 * to the desktop bell.
 *
 * Phone side:
 *   src/components/mobile/screens/profile/SystemNotificationsRow.tsx
 *   src/components/mobile/sheets/NotificationsOffBanner.tsx
 *   src/mobile/notificationPermission.ts
 * Desktop side: src/components/Notifications/NotificationDropdown.tsx
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('system notification settings stay on the phone', () => {
  it('the desktop bell mentions neither the row, the banner nor the permission module', () => {
    const dropdown = read('src/components/Notifications/NotificationDropdown.tsx');
    expect(dropdown).not.toMatch(
      /NotificationsOffBanner|SystemNotificationsRow|systemNotifications/
    );
  });

  it('only the phone tree imports mobile/notificationPermission', () => {
    let out = '';
    try {
      out = execSync(
        'git grep -l --untracked -E "mobile/notificationPermission" -- src capacitor ":!*__tests__*" ":!src/test/guards"',
        { encoding: 'utf8' }
      );
    } catch (err) {
      if ((err as { status?: number }).status !== 1) throw err;
    }
    const importers = out.split('\n').filter(Boolean).sort();
    expect(importers).toEqual([
      'capacitor/startApp.ts',
      'src/components/mobile/screens/profile/SystemNotificationsRow.tsx',
      'src/components/mobile/sheets/NotificationsOffBanner.tsx',
    ]);
  });

  it('the phone still has both surfaces', () => {
    expect(read('src/components/mobile/sheets/SettingsSheet.tsx')).toContain(
      'SystemNotificationsRow'
    );
    expect(read('src/components/mobile/sheets/NotificationsSheet.tsx')).toContain(
      'NotificationsOffBanner'
    );
  });
});
