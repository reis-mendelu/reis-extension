import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * The "would you support reIS?" test (2026-10-16) is a share of the students
 * who saw the question. Asking it on one product only would measure that
 * product's audience, not reIS's: the phone tree's Profil (which the iPad runs
 * too) and the extension's settings popup both ask it.
 */
const MOUNTS = [
  'src/components/mobile/screens/ProfileScreen.tsx',
  'src/components/Sidebar/ProfilePopup.tsx',
];

describe('the support question is on both trees', () => {
  it.each(MOUNTS)('%s renders SupportPrompt', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/<SupportPrompt\b/);
  });
});
