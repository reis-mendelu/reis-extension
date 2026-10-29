import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ScreenHeader } from '../ScreenHeader';

vi.mock('../../HeaderActions', () => ({ HeaderActions: () => null }));

/**
 * "Button 'reload' on calendar looks like it's supposed to refresh the data
 * instead of returning you to the current date" — reIS Task List, October 2026.
 * The title's way back to today wore lucide's RotateCcw, and ↺ reads as
 * refresh. A calendar page with a "1" on it reads as today.
 */
describe('ScreenHeader title action', () => {
  const renderAway = () =>
    render(
      <ScreenHeader title="Pá 30. 10." titleAction={{ label: 'Zpět na dnešek', onClick: vi.fn() }} />
    );

  it('marks the way back to today with a calendar glyph, not a refresh arrow', () => {
    renderAway();
    const button = screen.getByRole('button', { name: 'Pá 30. 10., Zpět na dnešek' });
    expect(button.querySelector('svg.lucide-calendar-1')).not.toBeNull();
    expect(button.querySelector('svg.lucide-rotate-ccw')).toBeNull();
  });

  it('draws no glyph when the title is not a control', () => {
    const { container } = render(<ScreenHeader title="Čt 29. 10." />);
    expect(screen.queryByRole('button')).toBeNull();
    expect(container.querySelector('svg')).toBeNull();
  });
});
