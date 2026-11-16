import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * The reisapp.cz guides reach the student from both trees (2026-11-16):
 * Nápověda in the profile, and a "Proč to nejde?" / "Jiný postup" link at the
 * moments a student is stuck. Each pair below is one capability on its two
 * trees; dropping either half leaves the student on that platform without it.
 *
 * Shared files carry it for both trees at once: EduroamExpiredNotice (the
 * drawer and the phone sheet render it) and DrawerTabBody + LoadFailed (the
 * desktop drawer and the phone sheet both render the Files tab).
 *
 * ISIC is the one phone-only link, because ISIC is phone-only: see
 * desktopHasNoIskam.test.ts, which already names IskamBalanceRow and
 * IskamTopUpForm.
 */
const read = (p: string) => readFileSync(p, 'utf8');

const BY_TREE: Record<string, { desktop: string; phone: string; mount: RegExp }> = {
  'Nápověda in the profile': {
    desktop: 'src/components/Sidebar/ProfilePopup.tsx',
    phone: 'src/components/mobile/screens/ProfileScreen.tsx',
    mount: /<(HelpLink|HelpRow) \/>/,
  },
  'eduroam error → troubleshooting': {
    desktop: 'src/components/Eduroam/EduroamDrawer.tsx',
    phone: 'src/components/mobile/sheets/EduroamSheetStatus.tsx',
    mount: /<GuideLink guide="eduroam" section="troubleshoot"/,
  },
  'exam term you cannot get onto → troubleshooting': {
    desktop: 'src/components/TermTile.tsx',
    phone: 'src/components/mobile/screens/exams/TermRowStatus.tsx',
    mount: /<GuideLink\s+guide="exams"\s+section="troubleshoot"/,
  },
};

const SHARED: Record<string, RegExp> = {
  'src/components/Eduroam/EduroamExpiredNotice.tsx':
    /<GuideLink guide="eduroam" section="troubleshoot"/,
  'src/components/SubjectFileDrawer/DrawerTabBody.tsx':
    /<GuideLink guide="subjects" section="official"/,
};

describe('the guides are on both trees', () => {
  it.each(Object.entries(BY_TREE))('%s', (_, { desktop, phone, mount }) => {
    expect(read(desktop), desktop).toMatch(mount);
    expect(read(phone), phone).toMatch(mount);
  });

  it.each(Object.entries(SHARED))('%s carries it for both', (file, mount) => {
    expect(read(file)).toMatch(mount);
  });

  it('the Help row and link open the guide index', () => {
    expect(read('src/components/mobile/screens/profile/HelpRow.tsx')).toContain(
      "guideUrl('index', language)"
    );
    expect(read('src/components/Sidebar/Profile/HelpLink.tsx')).toContain(
      "guideUrl('index', language)"
    );
  });

  it('ISIC is phone-only, and its links are on the phone sheets', () => {
    expect(read('src/test/guards/desktopHasNoIskam.test.ts')).toContain('IskamBalanceRow.tsx');
    for (const f of [
      'src/components/mobile/sheets/IskamBalanceRow.tsx',
      'src/components/mobile/sheets/IskamTopUpForm.tsx',
    ]) {
      expect(read(f), f).toMatch(/<GuideLink guide="isic" section="official"/);
    }
  });
});
