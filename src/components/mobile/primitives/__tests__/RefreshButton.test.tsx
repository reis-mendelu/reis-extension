import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RefreshButton } from '../RefreshButton';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * The refresh for whoever cannot pull.
 *
 * On a touch screen that is only a screen-reader user, so the button takes no
 * layout. On a Mac it is EVERYONE: the iPad app on Apple Silicon reports
 * `pointer: fine`, and neither a mouse drag nor a two-finger trackpad scroll
 * produces the touch events the pull listens for — so without a visible button
 * a Mac student could never ask for today's timetable by hand.
 */
describe('RefreshButton', () => {
  beforeEach(() => {
    useAppStore.setState({ isTouch: true } as never);
  });

  it('takes no layout on a touch screen, where the pull is the visible route', () => {
    render(<RefreshButton label="Obnovit rozvrh" refreshing={false} onRefresh={() => {}} />);
    expect(screen.getByRole('button', { name: 'Obnovit rozvrh' }).className).toContain('sr-only');
  });

  it('is a visible header action without a touch pointer, as on a Mac', () => {
    useAppStore.setState({ isTouch: false } as never);
    render(<RefreshButton label="Obnovit rozvrh" refreshing={false} onRefresh={() => {}} />);
    const button = screen.getByRole('button', { name: 'Obnovit rozvrh' });
    expect(button.className).not.toContain('sr-only');
    // The same 40px circle as the pin, search and bell beside it.
    expect(button.className).toContain('h-10');
    expect(button.className).toContain('w-10');
    expect(button.querySelector('svg')).not.toBeNull();
  });

  it('refreshes on a click, and cannot be pressed again while one runs', () => {
    useAppStore.setState({ isTouch: false } as never);
    const onRefresh = vi.fn();
    const { rerender } = render(
      <RefreshButton label="Obnovit rozvrh" refreshing={false} onRefresh={onRefresh} />
    );
    fireEvent.click(screen.getByRole('button', { name: 'Obnovit rozvrh' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<RefreshButton label="Obnovit rozvrh" refreshing onRefresh={onRefresh} />);
    const button = screen.getByRole('button', { name: 'Obnovit rozvrh' });
    expect(button).toBeDisabled();
    // The icon turns while the refresh runs: on a Mac there is no pull
    // indicator to say so.
    expect(button.querySelector('svg')?.getAttribute('class')).toContain('animate-spin');
  });
});
