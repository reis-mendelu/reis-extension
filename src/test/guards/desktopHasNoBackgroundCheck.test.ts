import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The background check is ANDROID-ONLY, on purpose.
 *
 * It is a JobScheduler job that runs the sync in a hidden WebView while the app
 * is closed and posts native notifications (android/.../BackgroundCheckService).
 * The extension has neither: a browser extension cannot run while the browser
 * is shut, and it has no system notifications (see
 * desktopHasNoExamSystemNotifications.test.ts). So the switch that controls it
 * would describe nothing there, and nothing in the extension may import the
 * code that drives it. The row is in the phone's Settings sheet only.
 *
 * Phone side:
 *   capacitor/background.ts, src/mobile/backgroundCheck.ts,
 *   src/mobile/backgroundCheckNative.ts,
 *   src/components/mobile/screens/profile/BackgroundCheckRow.tsx
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

function importers(pattern: string): string[] {
  try {
    return execSync(
      `git grep -l --untracked -E "${pattern}" -- src capacitor entrypoints ":!*__tests__*" ":!src/test/guards"`,
      { encoding: 'utf8' }
    )
      .split('\n')
      .filter(Boolean)
      .sort();
  } catch (err) {
    if ((err as { status?: number }).status !== 1) throw err;
    return [];
  }
}

describe('the background check stays on Android', () => {
  it('only the phone tree imports mobile/backgroundCheck*', () => {
    expect(importers('mobile/backgroundCheck')).toEqual([
      'capacitor/background.ts',
      'capacitor/main.capacitor.tsx',
      'capacitor/startApp.ts',
      'src/components/mobile/screens/profile/BackgroundCheckRow.tsx',
    ]);
  });

  it('the row is reached from the phone Settings sheet only', () => {
    expect(importers('BackgroundCheckRow')).toEqual([
      'src/components/mobile/screens/profile/BackgroundCheckRow.tsx',
      'src/components/mobile/sheets/SettingsSheet.tsx',
    ]);
    expect(read('src/components/mobile/sheets/SettingsSheet.tsx')).toContain('BackgroundCheckRow');
  });

  it('the desktop bell mentions none of it', () => {
    expect(read('src/components/Notifications/NotificationDropdown.tsx')).not.toMatch(
      /BackgroundCheck|backgroundCheck/
    );
  });

  it('the extension build never bundles the background entry', () => {
    expect(read('wxt.config.ts')).not.toMatch(/background\.html|capacitor\/background/);
  });
});
