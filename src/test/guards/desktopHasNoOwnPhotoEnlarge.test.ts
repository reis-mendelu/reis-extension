import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Tapping your OWN photo to enlarge it is phone/iPad only.
 *
 * On the phone, the Profile tab shows the student's own face, and tapping it
 * opens the `personPhoto` lightbox a classmate's photo already opens.
 *
 * The extension has nothing to tap: its own-profile popup
 * (`Sidebar/ProfilePopup.tsx`) shows the name beside a generic `User` glyph and
 * never fetches the student's photo. Enlarging a glyph is not a feature. If the
 * desktop popup ever gains the photo, this guard fails and the enlarge question
 * comes with it.
 *
 * Both halves are pinned, so a later "let's reuse the identity block" does not
 * silently drop the phone's button either.
 */
const read = (p: string) => readFileSync(resolve(process.cwd(), 'src', p), 'utf8');

describe('own photo enlarge placement', () => {
  it('components/Sidebar/ProfilePopup.tsx shows no own photo, so offers nothing to enlarge', () => {
    const popup = read('components/Sidebar/ProfilePopup.tsx');
    expect(popup).not.toMatch(/PersonPhoto|usePersonPhoto/);
    expect(popup).not.toContain('personPhoto');
  });

  it('components/mobile/screens/profile/ProfileIdentity.tsx opens the lightbox', () => {
    const identity = read('components/mobile/screens/profile/ProfileIdentity.tsx');
    expect(identity).toContain('usePersonPhoto');
    expect(identity).toContain("kind: 'personPhoto'");
  });

  it('components/mobile/screens/ProfileScreen.tsx renders that identity block', () => {
    expect(read('components/mobile/screens/ProfileScreen.tsx')).toContain('<ProfileIdentity />');
  });
});
