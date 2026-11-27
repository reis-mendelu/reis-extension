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

  /*
   * The critical-version pop-up (agreed 2026-11-20) follows the same split, for
   * the same reason. It is also the one phone message that is NOT a Novinky
   * row (one-place-per-message): it says the app itself is broken by a change
   * in IS, which a row in a list the student may never open cannot. Nothing
   * else may borrow that exception, and it is never a block: always closable,
   * at most twice (utils/criticalUpdate).
   */
  it('the critical-version pop-up and hint are on the phone tree only', () => {
    expect(read('components/mobile/MobileApp.tsx')).toContain('<CriticalUpdateDialog />');
    expect(read('components/mobile/screens/SubjectsScreen.tsx')).toContain(
      '<CriticalUpdateHint />'
    );
    expect(read('components/mobile/screens/ExamsScreen.tsx')).toContain('<CriticalUpdateHint />');
    for (const file of [
      'components/SubjectsPanel/index.tsx',
      'components/ExamPanel/EmptyExamsState.tsx',
      'components/Feedback/ReportMissingLink.tsx',
      'components/AppOverlays.tsx',
    ]) {
      expect(read(file), file).not.toMatch(/CriticalUpdate|criticalUpdate/);
    }
    // Phone-tree components, both of them:
    for (const file of [
      'components/mobile/CriticalUpdateDialog.tsx',
      'components/mobile/CriticalUpdateHint.tsx',
    ]) {
      expect(read(file), file).toContain('criticalUpdate');
    }
    // Only the phone's store check ever sets it.
    expect(read('mobile/criticalUpdate.ts')).toContain('setCriticalUpdate');
  });

  it('the pop-up can always be closed and never blocks reIS', () => {
    const dialog = read('components/mobile/CriticalUpdateDialog.tsx');
    expect(dialog).toContain("t('appUpdate.critical.later')");
    expect(dialog).toMatch(/data-testid="critical-update-backdrop"[\s\S]*?onClick=\{close\}/);
  });

  it('only the phone tree and the Capacitor boot import the store plugin wrapper', () => {
    expect(read('components/mobile/sheets/AppUpdateRow.tsx')).toContain('mobile/appUpdate');
    // Dynamic import inside, so @capawesome never enters the extension's graph.
    expect(read('mobile/appUpdate.ts')).not.toMatch(/^import .*@capawesome/m);
  });
});
