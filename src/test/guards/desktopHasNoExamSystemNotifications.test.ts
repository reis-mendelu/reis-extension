import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * "Za chvíli se otvírá zkouška" is a SYSTEM notification on the phone only
 * (spec docs/superpowers/specs/2026-10-20-exam-opening-reminders-design.md).
 *
 * The extension deliberately has none: it would need the `notifications`
 * permission (`alarms` it already has, for the session poke), a new store
 * declaration and review, and it would fire only while the browser runs. Both trees keep the in-app bell, which lists an
 * opening within 24 h. Both halves are pinned here.
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

describe('exam-opening reminders stay on the phone', () => {
  it('src/mobile/examReminders.ts is reached from the Capacitor entry only', () => {
    const importers = grep(
      'mobile/examReminders',
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

  it('src/hooks/useDeadlineAlerts.ts still gives both trees the opening in the bell', () => {
    expect(read('src/hooks/useDeadlineAlerts.ts')).toContain("type: 'exam-reg-opens'");
  });
});
