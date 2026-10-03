import { describe, it, expect } from 'vitest';
import { stepTab } from '../subjectTabStep';
import type { DrawerTab } from '../../../SubjectFileDrawer/types';

const ORDER: DrawerTab[] = ['files', 'classmates', 'stats', 'syllabus', 'zaznamnik'];
const NO_ID_DISABLED: DrawerTab[] = ['files', 'classmates', 'zaznamnik'];

describe('stepTab', () => {
  it('moves one tab forward and one back', () => {
    expect(stepTab(ORDER, 'files', 1, [])).toBe('classmates');
    expect(stepTab(ORDER, 'stats', -1, [])).toBe('classmates');
  });

  it('stays put at either end rather than wrapping round', () => {
    // A wrap from Záznamník to Soubory would read as the swipe going the
    // wrong way — the tab bar is a row, not a ring.
    expect(stepTab(ORDER, 'files', -1, [])).toBe('files');
    expect(stepTab(ORDER, 'zaznamnik', 1, [])).toBe('zaznamnik');
  });

  it('steps over a disabled tab to the next live one', () => {
    expect(stepTab(ORDER, 'files', 1, ['classmates'])).toBe('stats');
    expect(stepTab(ORDER, 'syllabus', -1, ['stats', 'classmates'])).toBe('files');
  });

  it('a subject without a subjectId only moves between the two live tabs', () => {
    expect(stepTab(ORDER, 'stats', 1, NO_ID_DISABLED)).toBe('syllabus');
    expect(stepTab(ORDER, 'syllabus', -1, NO_ID_DISABLED)).toBe('stats');
    // Everything past them is disabled, so these are the ends.
    expect(stepTab(ORDER, 'stats', -1, NO_ID_DISABLED)).toBe('stats');
    expect(stepTab(ORDER, 'syllabus', 1, NO_ID_DISABLED)).toBe('syllabus');
  });

  it('a zero step changes nothing', () => {
    expect(stepTab(ORDER, 'stats', 0, [])).toBe('stats');
  });
});
