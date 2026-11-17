import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import { openNovinkyFromNotification } from '../novinkyTaps';
import { NOVINKY_KIND } from '../novinkyPost';

describe('tapping a Novinky notification', () => {
  beforeEach(() => useAppStore.setState({ mobileSheets: [], language: 'cz' } as never));

  // 5.7.x's "Nové body" may still be in the tray after the update.
  it('a tap on a 5.7.x points notification still opens the subject', () => {
    openNovinkyFromNotification({ kind: 'zaznamnik-new-points', courseCode: 'EBC-VWA' });
    expect(useAppStore.getState().mobileSheets.at(-1)).toMatchObject({
      kind: 'subjectDrawer',
      courseCode: 'EBC-VWA',
      initialTab: 'zaznamnik',
    });
  });

  it('a tap on a new-term notification opens Zkoušky', () => {
    openNovinkyFromNotification({ kind: NOVINKY_KIND, group: 'terms', courseCode: 'EBC-VWA' });
    expect(useAppStore.getState().mobileTab).toBe('exams');
  });
});
