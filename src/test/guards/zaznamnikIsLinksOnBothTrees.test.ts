import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The záznamník's IS links (průběžné, výsledky testů) show on the phone and on
 * the desktop drawer alike.
 *
 * The phone sheet passes `showIsBacklink={false}` to every tab, because #341
 * removed the footer link those tabs used to duplicate. The záznamník tab
 * followed that flag and the phone lost its IS links. An IS outage, or a mark
 * reIS does not show, is exactly when a student needs the original, so this tab
 * has no opt-out. A later "pass the flag through for consistency" is how the
 * phone loses them again.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('záznamník IS links', () => {
  it("the tab body does not hand the záznamník the phone sheet's opt-out", () => {
    expect(read('components/SubjectFileDrawer/DrawerTabBody.tsx')).toMatch(
      /<ZaznamnikTab courseCode=\{[^}]*\} \/>/
    );
  });

  it('the tab has no opt-out of its own', () => {
    expect(read('components/SubjectFileDrawer/ZaznamnikTab.tsx')).not.toContain('showIsBacklink');
  });

  it('the phone sheet is the tree that opts the other tabs out', () => {
    expect(read('components/mobile/sheets/SubjectDrawerSheet.tsx')).toContain(
      'showIsBacklink={false}'
    );
  });
});
