import { describe, it, expect } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useMoreBelow } from '../useMoreBelow';

/**
 * The hook that keeps Profil's fade current. jsdom has no layout, so the
 * scroller's metrics are set by hand and the hook is driven by the events a
 * real scroller would fire.
 */
function Harness() {
  const ref = useRef<HTMLDivElement>(null);
  const more = useMoreBelow(ref);
  return (
    <div>
      <div ref={ref} data-testid="scroller">
        <div data-testid="content" />
      </div>
      <span data-testid="state">{more ? 'more' : 'end'}</span>
    </div>
  );
}

function setMetrics(
  el: HTMLElement,
  m: { scrollTop?: number; scrollHeight?: number; clientHeight?: number }
) {
  for (const [key, value] of Object.entries(m)) {
    Object.defineProperty(el, key, { configurable: true, writable: true, value });
  }
}

describe('useMoreBelow', () => {
  it('is off for a scroller whose content fits', () => {
    render(<Harness />);
    expect(screen.getByTestId('state').textContent).toBe('end');
  });

  it('turns on when content arrives below the fold, and off once scrolled to the end', async () => {
    render(<Harness />);
    const sc = screen.getByTestId('scroller');
    setMetrics(sc, { scrollTop: 0, scrollHeight: 646, clientHeight: 500 });
    // A row arriving late (ISIC, the study switcher) is a DOM change.
    await act(async () => {
      sc.firstElementChild!.appendChild(document.createElement('div'));
      await Promise.resolve();
    });
    expect(screen.getByTestId('state').textContent).toBe('more');

    setMetrics(sc, { scrollTop: 146 });
    fireEvent.scroll(sc);
    expect(screen.getByTestId('state').textContent).toBe('end');

    setMetrics(sc, { scrollTop: 40 });
    fireEvent.scroll(sc);
    expect(screen.getByTestId('state').textContent).toBe('more');
  });
});
