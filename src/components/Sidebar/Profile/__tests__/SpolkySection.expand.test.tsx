import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SpolkySection } from '../SpolkySection';

/**
 * On the profile TAB the society list expands fully; it does not scroll inside
 * itself.
 *
 * There are more societies than `max-h-40` (160px) can hold at ~34px a row, so
 * the list scrolled inside a screen that already scrolls — a scroller within a
 * scroller, which on a touch device means the outer page stops moving as soon
 * as a finger lands on the list.
 *
 * The desktop sidebar popup keeps the cap: it is a small floating panel with
 * nowhere to grow, which is what the cap was for.
 */
const props = {
  expanded: true,
  onToggle: () => {},
  isSub: () => true,
  onToggleAssoc: () => {},
  onNavigate: () => {},
};

const listOf = (container: HTMLElement) => container.querySelector('.space-y-1')?.className ?? '';

describe('SpolkySection height', () => {
  it('expands fully when asked to', () => {
    const { container } = render(<SpolkySection {...props} expandFully />);
    expect(listOf(container)).not.toContain('max-h-40');
    expect(listOf(container)).not.toContain('overflow-y-auto');
  });

  it('keeps the cap by default, for the desktop popup', () => {
    const { container } = render(<SpolkySection {...props} />);
    expect(listOf(container)).toContain('max-h-40');
    expect(listOf(container)).toContain('overflow-y-auto');
  });

  it('still lists every society either way', () => {
    render(<SpolkySection {...props} expandFully />);
    expect(screen.getByText('SUPEF')).toBeInTheDocument();
    expect(screen.getByText('ESN Mendelu')).toBeInTheDocument();
  });
});
