import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Sheet } from '../Sheet';

/**
 * Sheets stack, and `SheetHost` renders them as SIBLINGS in stack order. The
 * layering has to come out of that order, which means every layer of a sheet
 * has to sit above every layer of the sheet below it — the backdrop included.
 *
 * It did not. The backdrop was pinned one step BELOW the panel (z-50 vs
 * z-[51]), which is the right relationship inside one sheet and the wrong one
 * across two: a sheet pushed on top got a z-50 backdrop that painted
 * underneath the z-[51] panel of the sheet it was covering. The sheet below
 * was then neither dimmed nor tap-blocked — measured in the dev webapp at
 * 834x1194, `elementFromPoint` over the settings sheet's eduroam row returned
 * the row itself while the documents sheet was open — so tapping it pushed a
 * THIRD sheet, and eduroam slid up over documents instead of replacing it.
 * The same missing dim is why a person card opened from the classmates strip
 * read as one continuous surface with the drawer underneath it.
 *
 * Asserted as paint order rather than as literal z values: what matters is
 * that nothing of the lower sheet paints over the upper sheet's backdrop, not
 * which numbers get us there.
 */

/**
 * The `z-index` a layer will actually get, read off its Tailwind class. Read
 * from the class rather than `getComputedStyle`: jsdom loads no stylesheet, so
 * every computed `zIndex` is `auto` and every layer would compare equal — the
 * exact bug under test would pass unnoticed.
 */
function zIndexOf(el: HTMLElement): number {
  // `z-50` and `z-[51]` both appear; a bare `z-[...]` non-numeric value would
  // not be a stacking order we can reason about, so fail loudly instead.
  const match = el.className.match(/(?:^|\s)z-(?:\[(\d+)\]|(\d+))(?:\s|$)/);
  if (!match) throw new Error(`no numeric z-index class on: ${el.className}`);
  return Number(match[1] ?? match[2]);
}

/** Where `b` paints relative to `a`: >0 above, <0 below, 0 exactly equal. */
function paintOrder(a: HTMLElement, b: HTMLElement): number {
  const za = zIndexOf(a);
  const zb = zIndexOf(b);
  if (za !== zb) return zb - za;
  // Equal z-index: the later sibling paints on top.
  const rel = a.compareDocumentPosition(b);
  if (rel & Node.DOCUMENT_POSITION_FOLLOWING) return 1;
  if (rel & Node.DOCUMENT_POSITION_PRECEDING) return -1;
  return 0;
}

function TwoSheets({ onCloseTop = () => {} }: { onCloseTop?: () => void }) {
  return (
    <>
      {/* The settings sheet: full size, pushed first. */}
      <Sheet size="full" onClose={() => {}}>
        <button type="button">eduroam</button>
      </Sheet>
      {/* The documents sheet: content size, pushed on top of it. */}
      <Sheet size="content" onClose={onCloseTop}>
        docs
      </Sheet>
    </>
  );
}

describe('Sheet stacking', () => {
  it("puts the top sheet's backdrop above the panel of the sheet below it", () => {
    render(<TwoSheets />);
    const panels = screen.getAllByTestId('sheet-panel');
    const backdrops = screen.getAllByTestId('sheet-backdrop');
    expect(panels).toHaveLength(2);
    expect(backdrops).toHaveLength(2);

    // The whole point: the lower sheet must end up BEHIND the upper sheet's
    // backdrop, so it is dimmed and its controls are covered.
    expect(paintOrder(panels[0]!, backdrops[1]!)).toBeGreaterThan(0);
  });

  it('keeps each panel above its own backdrop', () => {
    render(<TwoSheets />);
    const panels = screen.getAllByTestId('sheet-panel');
    const backdrops = screen.getAllByTestId('sheet-backdrop');
    expect(paintOrder(backdrops[0]!, panels[0]!)).toBeGreaterThan(0);
    expect(paintOrder(backdrops[1]!, panels[1]!)).toBeGreaterThan(0);
  });

  it('keeps the top panel above everything below it', () => {
    render(<TwoSheets />);
    const panels = screen.getAllByTestId('sheet-panel');
    const backdrops = screen.getAllByTestId('sheet-backdrop');
    expect(paintOrder(panels[0]!, panels[1]!)).toBeGreaterThan(0);
    expect(paintOrder(backdrops[1]!, panels[1]!)).toBeGreaterThan(0);
  });

  /**
   * A pushed screen (the subject drawer) renders no backdrop of its own, so
   * the sheet that opens over it — a person card from the classmates strip —
   * is the one that has to bring the dim. Its backdrop must clear the screen's
   * full-bleed panel, which is the case the fixed z-50 got most wrong: the
   * panel covered `inset-0`, so the backdrop was hidden completely.
   */
  it("puts a sheet's backdrop above a pushed screen underneath it", () => {
    render(
      <>
        <Sheet size="full" variant="screen" onClose={() => {}}>
          drawer
        </Sheet>
        <Sheet size="content" onClose={() => {}}>
          person
        </Sheet>
      </>
    );
    const panels = screen.getAllByTestId('sheet-panel');
    const backdrop = screen.getByTestId('sheet-backdrop');
    expect(paintOrder(panels[0]!, backdrop)).toBeGreaterThan(0);
    expect(paintOrder(backdrop, panels[1]!)).toBeGreaterThan(0);
  });

  /**
   * `elevated` is for a confirm that mounts INSIDE the sheet it belongs to
   * (SignOutConfirm inside ProfileSheet) rather than going through SheetHost.
   * It has to stay above a plain sheet however the plain layers are numbered.
   */
  it('keeps an elevated sheet above a plain one', () => {
    render(
      <>
        <Sheet size="content" onClose={() => {}}>
          plain
        </Sheet>
        <Sheet size="content" elevated onClose={() => {}}>
          confirm
        </Sheet>
      </>
    );
    const panels = screen.getAllByTestId('sheet-panel');
    const backdrops = screen.getAllByTestId('sheet-backdrop');
    expect(paintOrder(panels[0]!, backdrops[1]!)).toBeGreaterThan(0);
    expect(paintOrder(backdrops[1]!, panels[1]!)).toBeGreaterThan(0);
  });

  /** The dim still closes the sheet it belongs to, and only that one. */
  it('closes the top sheet when its own backdrop is clicked', () => {
    const onCloseTop = vi.fn();
    render(<TwoSheets onCloseTop={onCloseTop} />);
    fireEvent.click(screen.getAllByTestId('sheet-backdrop')[1]!);
    expect(onCloseTop).toHaveBeenCalledTimes(1);
  });
});
