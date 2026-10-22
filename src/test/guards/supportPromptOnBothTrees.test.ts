import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * The "would you support reIS?" test (2026-10-16) is a share of the students
 * who saw the question. Asking it on one product only would measure that
 * product's audience, not reIS's: the phone tree's Novinky sheet (which the
 * iPad runs too) and the extension's Novinky dropdown both ask it.
 *
 * It lived in Profil until 2026-10-22, when Dominik moved it: messages live in
 * Novinky only, so it is a row there the student answers or dismisses.
 */
const MOUNTS = [
  'src/components/mobile/sheets/NotificationsSheet.tsx',
  'src/components/Notifications/NotificationDropdown.tsx',
];

const FORMER_MOUNTS = [
  'src/components/mobile/screens/ProfileScreen.tsx',
  'src/components/Sidebar/ProfilePopup.tsx',
];

describe('the support question is in Novinky on both trees', () => {
  it.each(MOUNTS)('%s renders SupportPrompt', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/<SupportPrompt\b/);
  });

  it.each(FORMER_MOUNTS)('%s no longer asks it', (path) => {
    expect(readFileSync(path, 'utf8')).not.toMatch(/SupportPrompt/);
  });
});
