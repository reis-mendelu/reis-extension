import { describe, it, expect } from 'vitest';
import { swipeStartIsOffLimits, EDGE_GUARD_PX } from '../swipeStartGuard';

/**
 * Where a sideways swipe may NOT start, because something else already owns a
 * sideways gesture there.
 *
 * happy-dom has no layout and no Tailwind, so the scroller cases set
 * `overflow-x` inline and stub the two sizes the guard compares.
 */
const WIDTH = 390;

function build() {
  const root = document.createElement('div');
  const scroller = document.createElement('div');
  const cell = document.createElement('span');
  scroller.appendChild(cell);
  root.appendChild(scroller);
  document.body.appendChild(root);
  return { root, scroller, cell };
}

function sizes(el: HTMLElement, scrollWidth: number, clientWidth: number) {
  Object.defineProperty(el, 'scrollWidth', { configurable: true, value: scrollWidth });
  Object.defineProperty(el, 'clientWidth', { configurable: true, value: clientWidth });
}

describe('swipeStartIsOffLimits', () => {
  it('lets a swipe start in the middle of plain content', () => {
    const { root, cell } = build();
    expect(swipeStartIsOffLimits(cell, root, 200, WIDTH)).toBe(false);
  });

  it('leaves both screen edges to the system back gesture', () => {
    const { root, cell } = build();
    expect(swipeStartIsOffLimits(cell, root, EDGE_GUARD_PX - 1, WIDTH)).toBe(true);
    expect(swipeStartIsOffLimits(cell, root, WIDTH - EDGE_GUARD_PX + 1, WIDTH)).toBe(true);
    expect(swipeStartIsOffLimits(cell, root, EDGE_GUARD_PX + 1, WIDTH)).toBe(false);
  });

  it('leaves a horizontal scroller that actually overflows to scroll', () => {
    const { root, scroller, cell } = build();
    scroller.style.overflowX = 'auto';
    sizes(scroller, 600, 300);
    expect(swipeStartIsOffLimits(cell, root, 200, WIDTH)).toBe(true);
  });

  it('does not block on a scroller whose content fits', () => {
    // A grading table that fits the width cannot scroll, so a swipe on it has
    // nothing else it could mean.
    const { root, scroller, cell } = build();
    scroller.style.overflowX = 'auto';
    sizes(scroller, 300, 300);
    expect(swipeStartIsOffLimits(cell, root, 200, WIDTH)).toBe(false);
  });

  it('ignores a pixel or two of accidental overflow on a vertical list', () => {
    // `overflow-y: auto` computes `overflow-x: auto` as well, so every vertical
    // scroller in a tab looks like a horizontal one to getComputedStyle. A list
    // a negative margin pushes 1px wider must not switch off the swipe on the
    // whole tab.
    const { root, scroller, cell } = build();
    scroller.style.overflowX = 'auto';
    sizes(scroller, 302, 300);
    expect(swipeStartIsOffLimits(cell, root, 200, WIDTH)).toBe(false);
  });

  it('does not count clipped overflow as a scroller', () => {
    const { root, scroller, cell } = build();
    scroller.style.overflowX = 'hidden';
    sizes(scroller, 600, 300);
    expect(swipeStartIsOffLimits(cell, root, 200, WIDTH)).toBe(false);
  });

  it('looks no further than the swipe root', () => {
    // Whatever scrolls ABOVE the root is not inside the swipe surface.
    const { root, cell } = build();
    const outer = document.createElement('div');
    outer.style.overflowX = 'auto';
    sizes(outer, 900, 300);
    root.replaceWith(outer);
    outer.appendChild(root);
    expect(swipeStartIsOffLimits(cell, root, 200, WIDTH)).toBe(false);
  });

  it('leaves text fields to their own caret drag', () => {
    const { root, scroller } = build();
    const input = document.createElement('input');
    scroller.appendChild(input);
    expect(swipeStartIsOffLimits(input, root, 200, WIDTH)).toBe(true);
  });

  // An empty `contenteditable` attribute means "true", and "plaintext-only" is
  // editable too; only "false" switches editing off.
  it.each([
    ['', true],
    ['true', true],
    ['plaintext-only', true],
    ['false', false],
  ])('treats contenteditable="%s" as a text field: %s', (value, blocked) => {
    const { root, scroller } = build();
    const host = document.createElement('div');
    host.setAttribute('contenteditable', value);
    const word = document.createElement('span');
    host.appendChild(word);
    scroller.appendChild(host);
    expect(swipeStartIsOffLimits(word, root, 200, WIDTH)).toBe(blocked);
  });
});
