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
});
