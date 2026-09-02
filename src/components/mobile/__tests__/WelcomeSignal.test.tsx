import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { useReducedMotion } from 'motion/react';
import { WelcomeSignal } from '../WelcomeSignal';

vi.mock('motion/react', async () => {
  const actual = await vi.importActual<typeof import('motion/react')>('motion/react');
  return { ...actual, useReducedMotion: vi.fn().mockReturnValue(false) };
});

afterEach(() => {
  cleanup();
  vi.mocked(useReducedMotion).mockReturnValue(false);
});

describe('WelcomeSignal', () => {
  it('draws every ring at its full radius, not at an animated-to one', () => {
    // The regression this guards: an entrance that animated `r`/`opacity` from
    // zero left the pane empty wherever the frame loop was paused (a tab that
    // boots in the background), which is the exact void this element exists to
    // fill.
    const { container } = render(<WelcomeSignal />);
    const rings = [...container.querySelectorAll('circle')];

    expect(rings).toHaveLength(6);
    for (const ring of rings) {
      expect(Number(ring.getAttribute('r'))).toBeGreaterThan(0);
      expect(Number(ring.getAttribute('opacity'))).toBeGreaterThan(0);
    }
  });

  it('is decorative: hidden from the accessibility tree and untouchable', () => {
    const { container } = render(<WelcomeSignal />);
    const svg = container.querySelector('svg');

    expect(svg).toHaveAttribute('aria-hidden');
    expect(svg?.getAttribute('class')).toContain('pointer-events-none');
  });

  it('renders only from the md breakpoint up — a phone has no width to fill', () => {
    const { container } = render(<WelcomeSignal />);
    const cls = container.querySelector('svg')?.getAttribute('class') ?? '';

    expect(cls).toContain('hidden');
    expect(cls).toContain('md:block');
  });

  it('still draws its rings when motion is reduced', () => {
    vi.mocked(useReducedMotion).mockReturnValue(true);
    const { container } = render(<WelcomeSignal />);

    expect(container.querySelectorAll('circle')).toHaveLength(6);
  });
});
