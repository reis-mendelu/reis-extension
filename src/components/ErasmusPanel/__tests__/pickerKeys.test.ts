import { describe, it, expect, vi } from 'vitest';
import type { KeyboardEvent } from 'react';
import { pickerKeyDown } from '../pickerKeys';

const key = (k: string, isComposing = false) =>
  ({
    key: k,
    preventDefault: vi.fn(),
    nativeEvent: { isComposing },
  }) as unknown as KeyboardEvent & {
    preventDefault: () => void;
  };

describe('pickerKeyDown', () => {
  it('Enter picks the top result while the list is open', () => {
    const pick = vi.fn();
    pickerKeyDown(key('Enter'), true, vi.fn(), 'Wien', pick);
    expect(pick).toHaveBeenCalledWith('Wien');
  });

  // Release review (cubic): after Escape the hidden list keeps its results,
  // and Enter silently picked one the student could not see.
  it('Enter picks nothing while the list is closed', () => {
    const pick = vi.fn();
    pickerKeyDown(key('Enter'), false, vi.fn(), 'Wien', pick);
    expect(pick).not.toHaveBeenCalled();
  });

  // #622 review: Enter that commits an IME composition is the input method's.
  it('Enter that commits an IME composition picks nothing', () => {
    const pick = vi.fn();
    pickerKeyDown(key('Enter', true), true, vi.fn(), 'Wien', pick);
    expect(pick).not.toHaveBeenCalled();
  });
});
