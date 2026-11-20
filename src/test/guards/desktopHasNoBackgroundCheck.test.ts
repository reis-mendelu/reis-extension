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
    ]);
  });

  // No switch of its own (folded 2026-11-17): the phone's notification setting
  // turns it off, so no "Oznámení" row sits beside "Oznámení v telefonu".
  it('has no Settings row of its own', () => {
    expect(read('src/components/mobile/sheets/SettingsSheet.tsx')).not.toMatch(/BackgroundCheck/);
  });

  it('the desktop bell mentions none of it', () => {
    expect(read('src/components/Notifications/NotificationDropdown.tsx')).not.toMatch(
      /BackgroundCheck|backgroundCheck/
    );
  });

  it('no extension entrypoint imports the background entry', () => {
    // The WXT entrypoints are the extension's whole import graph's roots.
    expect(
      importers('capacitor/background').filter((f) => f.startsWith('src/entrypoints'))
    ).toEqual([]);
  });

  it('the extension build never bundles the background entry', () => {
    expect(read('wxt.config.ts')).not.toMatch(/background\.html|capacitor\/background/);
  });
});
