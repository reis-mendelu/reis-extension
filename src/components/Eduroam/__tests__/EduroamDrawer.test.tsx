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
  it('renders nothing when closed', () => {
    useAppStore.setState({ isEduroamOpen: false, isTouch: false, isNarrow: false });
    const { container } = render(<EduroamDrawer />);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders the title and four device cards when open', () => {
    open();
    render(<EduroamDrawer />);
    expect(screen.getByText('eduroam Wi-Fi')).toBeTruthy();
    expect(screen.getByRole('button', { name: /iPhone/i })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Windows/i })).toBeTruthy();
  });

  it('expands a device tutorial on select and returns via "pick another device"', () => {
    open();
    render(<EduroamDrawer />);
    fireEvent.click(screen.getByRole('button', { name: /Android/i }));
    expect(screen.getByText('Set up eduroam')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: /Pick another device/i }));
    expect(screen.queryByText('Set up eduroam')).toBeNull();
  });

  it('closes via the close button', () => {
    open();
    render(<EduroamDrawer />);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(useAppStore.getState().isEduroamOpen).toBe(false);
  });
});
