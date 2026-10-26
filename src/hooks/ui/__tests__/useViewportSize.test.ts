import { describe, it, expect } from 'vitest';
import { tallestAtWidth } from '../useViewportSize';

describe('tallestAtWidth', () => {
  // A landscape iPad with the keyboard up is phone-height; the floor column
  // would jump back under the rail while the student types.
  it('ignores the keyboard shortening the screen', () => {
    const open = tallestAtWidth({ width: 1194, height: 834 }, 1194, 440);
    expect(open).toEqual({ width: 1194, height: 834 });
  });

  it('grows when the screen does', () => {
    expect(tallestAtWidth({ width: 1194, height: 440 }, 1194, 834)).toEqual({
      width: 1194,
      height: 834,
    });
  });

  // Rotation changes the width, and the old height is then meaningless.
  it('starts over when the width changes', () => {
    expect(tallestAtWidth({ width: 834, height: 1112 }, 1194, 834)).toEqual({
      width: 1194,
      height: 834,
    });
  });
});
