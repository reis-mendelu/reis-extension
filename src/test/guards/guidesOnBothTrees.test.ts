import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Nápověda reaches the reisapp.cz guides from both trees (2026-11-16): the
 * phone/iPad Profil (HelpRow, above "Nahlásit chybu") and the extension's
 * profile popup (HelpLink, same place). Dropping either half leaves the
 * student on that platform without it.
 *
 * One entry point, the guide index, and no contextual links at stuck moments:
 * the list of guides is kept in one place, the site (Dominik, 2026-11-16).
 */
const read = (p: string) => readFileSync(p, 'utf8');

describe('Nápověda is on both trees', () => {
  it('the phone Profil mounts HelpRow', () => {
    expect(read('src/components/mobile/screens/ProfileScreen.tsx')).toMatch(/<HelpRow \/>/);
  });

  it('the extension profile popup mounts HelpLink', () => {
    expect(read('src/components/Sidebar/ProfilePopup.tsx')).toMatch(/<HelpLink \/>/);
  });

  it.each([
    'src/components/mobile/screens/profile/HelpRow.tsx',
    'src/components/Sidebar/Profile/HelpLink.tsx',
  ])('%s opens the guide index', (file) => {
    expect(read(file)).toContain('guidesIndexUrl(language)');
  });
});
