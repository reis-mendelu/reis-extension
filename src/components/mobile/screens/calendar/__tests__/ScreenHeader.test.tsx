import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { ScreenHeader } from '../ScreenHeader';

vi.mock('../../HeaderActions', () => ({ HeaderActions: () => null }));

/**
 * "Button 'reload' on calendar looks like it's supposed to refresh the data
 * instead of returning you to the current date" — reIS Task List, October 2026.
 * The title's way back to today wore lucide's RotateCcw, and ↺ reads as
 * refresh. A calendar page with a "1" on it reads as today.
 *
 * The icons are found by lucide's own `lucide-<name>` class. A lucide rename
 * fails this test for a reason unrelated to the fix; read it as that, not as
 * the glyph having changed.
 */
describe('ScreenHeader title action', () => {
  const renderAway = (onClick = vi.fn()) => {
    render(<ScreenHeader title="Pá 30. 10." titleAction={{ label: 'Zpět na dnešek', onClick }} />);
    return screen.getByRole('button', { name: 'Pá 30. 10., Zpět na dnešek' });
  };

  it('marks the way back to today with a calendar glyph, not a refresh arrow', () => {
    const button = renderAway();
    expect(button.querySelector('svg.lucide-calendar-1')).not.toBeNull();
    expect(button.querySelector('svg.lucide-rotate-ccw')).toBeNull();
  });

  it('still takes the student back to today when tapped', () => {
    const onClick = vi.fn();
    fireEvent.click(renderAway(onClick));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('draws no glyph when the title is not a control', () => {
    const { container } = render(<ScreenHeader title="Čt 29. 10." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});
