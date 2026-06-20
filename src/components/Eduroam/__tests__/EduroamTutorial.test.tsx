import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EduroamTutorial } from '../EduroamTutorial';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => { cleanup(); useAppStore.setState({ language: 'en' }); });

const base = {
  status: 'idle' as const, qrDataUrl: null, password: null,
  onRun: () => {}, onOpenSettings: () => {},
};

describe('EduroamTutorial', () => {
  it('renders the do-once block only for android/windows', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="android" {...base} />);
    expect(screen.getByText('Install the geteduroam app')).toBeTruthy();
    rerender(<EduroamTutorial target="ios" {...base} />);
    expect(screen.queryByText(/geteduroam app$/)).toBeNull();
  });

  it('calls onRun when the action button is clicked', () => {
    useAppStore.setState({ language: 'en' });
    const onRun = vi.fn();
    render(<EduroamTutorial target="ios" {...base} onRun={onRun} />);
    fireEvent.click(screen.getByRole('button', { name: /Create QR code|Download eduroam profile/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it('shows the QR image once qrDataUrl is set', () => {
    useAppStore.setState({ language: 'en' });
    render(<EduroamTutorial target="ios" {...base} status="done" qrDataUrl="data:image/png;base64,AAA" />);
    expect(screen.getByAltText(/eduroam QR/i)).toBeTruthy();
  });

  it('renders the password chip only when a password is present', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="mac" {...base} />);
    expect(screen.queryByText('abc-123')).toBeNull();
    rerender(<EduroamTutorial target="mac" {...base} status="done" password="abc-123" />);
    expect(screen.getByText('abc-123')).toBeTruthy();
  });

  it('shows the done banner only once status is done', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="mac" {...base} />);
    expect(screen.queryByText(/Done — you're on eduroam/i)).toBeNull();
    rerender(<EduroamTutorial target="mac" {...base} status="done" />);
    expect(screen.getByText(/Done — you're on eduroam/i)).toBeTruthy();
  });

  it('calls onOpenSettings from the mac open-settings step', () => {
    useAppStore.setState({ language: 'en' });
    const onOpenSettings = vi.fn();
    render(<EduroamTutorial target="mac" {...base} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /Open Profiles settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
