import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AlwaysScrollable } from '../AlwaysScrollable';

/**
 * "u všech těch záložek … by měla být možnost jezdit nahoru a dolů pomocí
 * prstu". Every tab scrolls once it overflows, but on most phones a tab fits,
 * and a list that fits does not move under a drag — it felt frozen next to
 * every other list on the device. Holding the content one pixel taller than
 * its scroller gives iOS something to rubber-band, with no visible gap.
 */
describe('AlwaysScrollable', () => {
  it('holds its content one pixel taller than the scroller', () => {
    render(
      <AlwaysScrollable className="gap-4 px-4">
        <span>row</span>
      </AlwaysScrollable>
    );
    const box = screen.getByText('row').parentElement!;
    expect(box.className).toContain('min-h-[calc(100%+1px)]');
    // The caller's own layout rides on the same box, not a second one.
    expect(box.className).toContain('gap-4');
  });
});
