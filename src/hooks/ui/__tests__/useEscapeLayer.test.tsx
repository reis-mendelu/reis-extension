import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
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

  it('reports whether any layer is open, for the phone sheet stack to yield', () => {
    const { rerender } = render(<Layer open onClose={() => {}} />);
    expect(hasOpenEscapeLayer()).toBe(true);
    rerender(<Layer open={false} onClose={() => {}} />);
    expect(hasOpenEscapeLayer()).toBe(false);
  });
});
