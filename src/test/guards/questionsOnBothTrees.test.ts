import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';

/**
 * A console question is a share of the students who saw it. Asked on one
 * product only, it would measure that product's audience, not reIS's — which
 * is exactly what the retired NpsBanner did: it was mounted in the extension's
 * AppMain only, so its 131 answers spoke for one student in seven.
 *
 * So the rows sit in Novinky on both trees (the phone's sheet, which the iPad
 * runs too, and the extension's dropdown), and both bells count them.
 */
const ROWS = [
  'src/components/mobile/sheets/NotificationsSheet.tsx',
  'src/components/Notifications/NotificationDropdown.tsx',
];
const BELLS = [
  'src/components/mobile/screens/HeaderActions.tsx',
  'src/components/NotificationFeed.tsx',
];

describe('console questions are in Novinky on both trees', () => {
  it.each(ROWS)('%s renders QuestionList', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/<QuestionList\b/);
  });

  it.each(BELLS)('%s counts unanswered questions on the bell', (path) => {
    expect(readFileSync(path, 'utf8')).toMatch(/questions\.badge/);
  });

  it('the extension-only rating banner is gone', () => {
    expect(readFileSync('src/components/AppMain.tsx', 'utf8')).not.toMatch(/NpsBanner/);
  });
});
