import { describe, it, expect, vi } from 'vitest';
import { handleBackPress } from '../backButton';

describe('handleBackPress', () => {
  it('pops the top sheet when the stack is not empty', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 1, popSheet })).toBe('popped');
    expect(popSheet).toHaveBeenCalledOnce();
  });

  it('pops only one level per press, so nested sheets unwind one at a time', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 3, popSheet })).toBe('popped');
    expect(popSheet).toHaveBeenCalledOnce();
  });

  it('signals exit when no sheet is open', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 0, popSheet })).toBe('exit');
    expect(popSheet).not.toHaveBeenCalled();
  });

  it('treats a negative count defensively as empty', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: -1, popSheet })).toBe('exit');
    expect(popSheet).not.toHaveBeenCalled();
  });

  /*
   * Three cases about the vývěska used to sit here, because it was a portal
   * outside the stack and needed a branch of its own. It is a sheet now — see
   * sheets/BulletinSheet — so the ordinary sheet cases above cover it, and the
   * branch and its special-case tests are both gone.
   */

  /**
   * Calendar is the app's start destination, the way Android expects a bottom
   * nav to behave: back from any other tab returns there instead of quitting.
   * Before this, pressing back on Zkoušky/Předměty/Mapa closed the app.
   */
  // 'profile' included: it became a bottom-nav tab in this PR, and the table
  // it was added to never grew to cover it. Raised in review.
  it.each(['exams', 'subjects', 'map', 'profile'] as const)(
    'returns to the calendar from the %s tab instead of exiting',
    (tab) => {
      const popSheet = vi.fn();
      const goToCalendar = vi.fn();
      expect(handleBackPress({ sheetCount: 0, popSheet, tab, goToCalendar })).toBe('popped');
      expect(goToCalendar).toHaveBeenCalledOnce();
    }
  );

  it('exits from the calendar tab, which is the start destination', () => {
    const popSheet = vi.fn();
    const goToCalendar = vi.fn();
    expect(handleBackPress({ sheetCount: 0, popSheet, tab: 'calendar', goToCalendar })).toBe(
      'exit'
    );
    expect(goToCalendar).not.toHaveBeenCalled();
  });

  /**
   * A sheet belongs to the screen that opened it, so it must unwind before the
   * tab switches out from under it — otherwise one press would both close the
   * sheet and change screens.
   */
  it('pops a sheet before switching tabs', () => {
    const popSheet = vi.fn();
    const goToCalendar = vi.fn();
    expect(handleBackPress({ sheetCount: 1, popSheet, tab: 'subjects', goToCalendar })).toBe(
      'popped'
    );
    expect(popSheet).toHaveBeenCalledOnce();
    expect(goToCalendar).not.toHaveBeenCalled();
  });

  /**
   * The pre-tab callers (and the login WebView, which registers this listener
   * before any tab exists) pass no tab at all — they must still exit.
   */
  it('exits when no tab is supplied', () => {
    const popSheet = vi.fn();
    expect(handleBackPress({ sheetCount: 0, popSheet })).toBe('exit');
  });
});
