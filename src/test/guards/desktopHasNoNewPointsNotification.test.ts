import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Nové body" from the záznamník is a SYSTEM notification on the phone/iPad
 * only (decided 2026-10-20).
 *
 * The extension deliberately has none: it would need the `notifications`
 * permission, which changes the Chrome and Firefox store declarations and sends
 * the extension back through store review, for something that could only fire
 * while the browser runs anyway. Both trees list "Nové body" in Novinky,
 * where every message in reIS lives. Both halves are pinned here.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');
const grep = (pattern: string, paths: string) => {
  try {
    // Double quotes: execSync runs cmd.exe on Windows, where single quotes are literal.
    return execSync(`git grep -l --untracked -E "${pattern}" -- ${paths}`, {
      encoding: 'utf8',
    }).trim();
  } catch (err) {
    if ((err as { status?: number }).status === 1) return '';
    throw err;
  }
};

describe('záznamník new points: system notification on the phone only', () => {
  it('src/mobile/zaznamnikNotifications.ts is reached from the Capacitor entry only', () => {
    const importers = grep(
      'mobile/zaznamnikNotifications',
      'src capacitor ":!*__tests__*" ":!src/test/guards"'
    )
      .split('\n')
      .filter(Boolean);
    // startApp installs it; main.capacitor registers its sign-out cleanup.
    expect(importers.sort()).toEqual(['capacitor/main.capacitor.tsx', 'capacitor/startApp.ts']);
  });

  it('the extension asks for no notification permission', () => {
    expect(grep('chrome\\.notifications|browser\\.notifications', 'src wxt.config.ts')).toBe('');
    expect(read('wxt.config.ts')).not.toMatch(/['"]notifications['"]/);
  });

  it('both trees list the new points in Novinky, and a row opens the subject', () => {
    expect(read('src/hooks/useDeadlineAlerts.ts')).toContain('newPointsAlerts(');
    // desktop: the bell dropdown, fed from the header that can open a drawer
    expect(read('src/components/AppHeader.tsx')).toContain(
      "onOpenSubject?.(a.courseCode, a.title, a.courseId, undefined, 'zaznamnik')"
    );
    // phone and iPad: the Novinky sheet
    expect(read('src/components/mobile/sheets/NotificationsSheet.tsx')).toContain(
      "initialTab: 'zaznamnik'"
    );
  });
});
