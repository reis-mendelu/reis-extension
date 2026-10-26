import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, act } from '@testing-library/react';
import { useEscapeLayer, hasOpenEscapeLayer } from '../useEscapeLayer';

/**
 * Escape closes the topmost overlay, and only that one.
 *
 * Overlays nest — a classmate's drawer opens over the subject drawer that
 * listed them — so a listener per overlay that closed on any Escape shut both
 * at once. The layer that opened last is the one on top.
 */
function Layer({ open, onClose }: { open: boolean; onClose: () => void }) {
  useEscapeLayer(open, onClose);
  return null;
}

const escape = () => fireEvent.keyDown(document, { key: 'Escape' });

describe('useEscapeLayer', () => {
  it('closes an open layer on Escape', () => {
    const onClose = vi.fn();
    render(<Layer open onClose={onClose} />);
    escape();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does nothing while closed', () => {
    const onClose = vi.fn();
    render(<Layer open={false} onClose={onClose} />);
    escape();
    expect(onClose).not.toHaveBeenCalled();
    expect(hasOpenEscapeLayer()).toBe(false);
  });

  it('closes only the layer opened last', () => {
    const under = vi.fn();
    const over = vi.fn();
    const { rerender } = render(
      <>
        <Layer open onClose={under} />
        <Layer open={false} onClose={over} />
      </>
    );
    rerender(
      <>
        <Layer open onClose={under} />
        <Layer open onClose={over} />
      </>
    );
    escape();
    expect(over).toHaveBeenCalledTimes(1);
    expect(under).not.toHaveBeenCalled();
  });

  it('hands Escape down once the top layer has gone', () => {
    const under = vi.fn();
    const { rerender } = render(
      <>
        <Layer open onClose={under} />
        <Layer open onClose={() => {}} />
      </>
    );
    rerender(
      <>
        <Layer open onClose={under} />
        <Layer open={false} onClose={() => {}} />
      </>
    );
    escape();
    expect(under).toHaveBeenCalledTimes(1);
  });

  it('yields to a control inside that already used the Escape', () => {
    // An inline title editor cancels its edit on Escape; the drawer must stay.
    const onClose = vi.fn();
    render(<Layer open onClose={onClose} />);
    const event = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true });
    event.preventDefault();
    document.dispatchEvent(event);
    expect(onClose).not.toHaveBeenCalled();
  });

  // A held key auto-repeats. One press closes one layer; the repeats must not
  // walk on down the pile and close everything under it.
  it('ignores the auto-repeat of a held Escape', () => {
    const onClose = vi.fn();
    render(<Layer open onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape', repeat: true });
    expect(onClose).not.toHaveBeenCalled();
  });

  // React runs a child's effects before its parent's, so a parent and the
  // layer inside it, mounting in one commit, used to register child-first and
  // leave the PARENT on top: Escape closed the outer one.
  it('a layer mounted inside another in the same commit is the one on top', () => {
    const outer = vi.fn();
    const inner = vi.fn();
    function Outer() {
      useEscapeLayer(true, outer);
      return <Layer open onClose={inner} />;
    }
    render(<Outer />);
    escape();
    expect(inner).toHaveBeenCalledTimes(1);
    expect(outer).not.toHaveBeenCalled();
  });

  // Two user actions are two tasks, so the commits are apart; the boundary is
  // what the stack groups opens by.
  it('a layer opened later is on top of one mounted earlier, whatever the mount order', async () => {
    const early = vi.fn();
    const late = vi.fn();
    const { rerender } = render(
      <>
        <Layer open={false} onClose={early} />
        <Layer open onClose={late} />
      </>
    );
    await act(async () => {});
    rerender(
      <>
        <Layer open onClose={early} />
        <Layer open onClose={late} />
      </>
    );
    escape();
    expect(early).toHaveBeenCalledTimes(1);
    expect(late).not.toHaveBeenCalled();
  });

  it('reports whether any layer is open, for the phone sheet stack to yield', () => {
    const { rerender } = render(<Layer open onClose={() => {}} />);
    expect(hasOpenEscapeLayer()).toBe(true);
    rerender(<Layer open={false} onClose={() => {}} />);
    expect(hasOpenEscapeLayer()).toBe(false);
  });
});
