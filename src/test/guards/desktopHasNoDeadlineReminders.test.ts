import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The scheduled reminders ("Zítra: zkouška", "přihlašování končí", "odevzdání
 * do zítra") are PHONE-ONLY, on purpose. The extension has no system
 * notifications: they would need Chrome's `notifications` permission, which
 * switches the extension off at update until accepted, and they could fire
 * only while the browser runs (decided 2026-11-17). The extension shows the
 * same dates as Novinky rows in its bell.
 *
 * Phone side: src/mobile/deadlineReminders.ts (+ its taps in src/mobile/novinkyTaps.ts)
 * Planner, shared and pure: src/utils/deadlineReminders.ts
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), p), 'utf8');

describe('scheduled deadline reminders stay on the phone', () => {
  it('src/mobile/deadlineReminders.ts is reached from the Capacitor entry only', () => {
    let out = '';
    try {
      out = execSync(
        'git grep -l --untracked -E "(from |import\\()\'[^\']*mobile/deadlineReminders\'" -- src capacitor ":!*__tests__*" ":!src/test/guards"',
        { encoding: 'utf8' }
      );
    } catch (err) {
      if ((err as { status?: number }).status !== 1) throw err;
    }
    expect(out.split('\n').filter(Boolean).sort()).toEqual([
      'capacitor/main.capacitor.tsx',
      'capacitor/startApp.ts',
    ]);
  });

  it('the extension asks for no notification permission', () => {
    expect(read('wxt.config.ts')).not.toMatch(/['"]notifications['"]/);
  });

  it('both trees still show the same dates as Novinky rows', () => {
    const rows = read('src/utils/exams/examAlerts.ts');
    expect(rows).toContain("type: 'exam-registered'");
    expect(rows).toContain('latestRegistrationChance(');
  });
});
