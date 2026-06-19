import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EduroamDrawer } from '../EduroamDrawer';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => {
  cleanup();
  useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
});

function open() {
  useAppStore.setState({ isEduroamOpen: true, isTouch: false, isNarrow: false, language: 'en' });
}

describe('EduroamDrawer', () => {
  it('renders nothing when isEduroamOpen is false', () => {
    useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
    const { container } = render(<EduroamDrawer />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the title and three device segments when open', () => {
    open();
    render(<EduroamDrawer />);
    expect(screen.getByText('eduroam Wi-Fi')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /iPhone/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Android/i })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Mac/i })).toBeTruthy();
  });

  it('switches the active device segment on click', () => {
    open();
    render(<EduroamDrawer />);
    const android = screen.getByRole('tab', { name: /Android/i });
    fireEvent.click(android);
    expect(android.getAttribute('aria-selected')).toBe('true');
  });

  it('closes via the close button', () => {
    open();
    render(<EduroamDrawer />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });
});
