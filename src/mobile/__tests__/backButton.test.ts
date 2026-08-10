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

  /**
   * The vývěska overlay is NOT a sheet — it lives in its own `bulletinExpanded`
   * store flag and portals to document.body. So with it open the stack was
   * still empty, back returned 'exit', and reading the noticeboard and pressing
   * back quit the app.
   */
  it('closes the bulletin overlay rather than exiting', () => {
    const popSheet = vi.fn();
    const closeBulletin = vi.fn();
    expect(handleBackPress({ sheetCount: 0, popSheet, bulletinOpen: true, closeBulletin })).toBe(
      'popped'
    );
    expect(closeBulletin).toHaveBeenCalledOnce();
    expect(popSheet).not.toHaveBeenCalled();
  });

  /**
   * A sheet opened on top of the bulletin must unwind first — it is drawn above
   * it, so closing what is underneath would be invisible to the student.
   */
  it('pops a sheet before the bulletin when both are open', () => {
    const popSheet = vi.fn();
    const closeBulletin = vi.fn();
    expect(handleBackPress({ sheetCount: 1, popSheet, bulletinOpen: true, closeBulletin })).toBe(
      'popped'
    );
    expect(popSheet).toHaveBeenCalledOnce();
    expect(closeBulletin).not.toHaveBeenCalled();
  });

  it('still exits when the bulletin is closed', () => {
    const popSheet = vi.fn();
    const closeBulletin = vi.fn();
    expect(handleBackPress({ sheetCount: 0, popSheet, bulletinOpen: false, closeBulletin })).toBe(
      'exit'
    );
    expect(closeBulletin).not.toHaveBeenCalled();
  });

  /**
   * Calendar is the app's start destination, the way Android expects a bottom
   * nav to behave: back from any other tab returns there instead of quitting.
   * Before this, pressing back on Zkoušky/Předměty/Mapa/Student closed the app.
   */
  it.each(['exams', 'subjects', 'map', 'student'] as const)(
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
   * The bulletin is a calendar-tab overlay, but ordering it ahead of the tab
   * step costs nothing and keeps the rule "innermost surface first" intact.
   */
  it('closes the bulletin before switching tabs', () => {
    const popSheet = vi.fn();
    const closeBulletin = vi.fn();
    const goToCalendar = vi.fn();
    expect(
      handleBackPress({
        sheetCount: 0,
        popSheet,
        bulletinOpen: true,
        closeBulletin,
        tab: 'exams',
        goToCalendar,
      })
    ).toBe('popped');
    expect(closeBulletin).toHaveBeenCalledOnce();
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
