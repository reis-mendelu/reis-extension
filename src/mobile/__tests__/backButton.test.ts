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
});
