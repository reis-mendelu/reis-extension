import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * Partners are promised a place in front of their field on EVERY product
 * (spec 2026-10-09): the phone tree's Profil (AboutSection, which the iPad
 * runs too) and the extension's settings popup (ProfilePopup). Dropping either
 * mount silently breaks a promise made to a paying partner.
 */
const MOUNTS = [
  'src/components/mobile/screens/profile/AboutSection.tsx',
  'src/components/Sidebar/ProfilePopup.tsx',
];

describe('the partners block is on both trees', () => {
  it.each(MOUNTS)('%s renders PartnersBlock', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/<PartnersBlock\b/);
  });
});
