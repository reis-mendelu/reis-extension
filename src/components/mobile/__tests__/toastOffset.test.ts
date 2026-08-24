import { describe, it, expect } from 'vitest';
import { toastOffset, DEMO_BANNER_HEIGHT } from '../toastOffset';

describe('toastOffset', () => {
  it('insets the toast by the safe area when the banner is absent', () => {
    expect(toastOffset(false).top).toBe('calc(1rem + var(--safe-top, 0px))');
  });

  // The banner and the toast were both anchored to the top and both spent
  // --safe-top, so a demo toast landed on top of the banner it was explaining.
  it('clears the banner as well when demo mode is on', () => {
    const top = toastOffset(true).top;

    expect(top).toContain('var(--safe-top, 0px)');
    expect(top).toContain(DEMO_BANNER_HEIGHT);
  });

  it('keeps sonner’s own mobile side and bottom insets in both states', () => {
    for (const demo of [false, true]) {
      expect(toastOffset(demo)).toMatchObject({ right: '16px', left: '16px', bottom: '16px' });
    }
  });
});
