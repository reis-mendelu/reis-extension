import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { EduroamTutorial } from '../EduroamTutorial';
import { useAppStore } from '../../../store/useAppStore';

afterEach(() => { cleanup(); useAppStore.setState({ language: 'en' }); });

const base = {
  status: 'idle' as const, qrDataUrl: null, password: null, identity: null,
  onRun: () => {}, onOpenSettings: () => {},
};

describe('EduroamTutorial', () => {
  it('renders the geteduroam do-once block only for windows, not android', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="windows" {...base} />);
    expect(screen.getByText('Install geteduroam for Windows')).toBeTruthy();
    // Android is the manual EAP-TLS flow now — no geteduroam anywhere.
    rerender(<EduroamTutorial target="android" {...base} />);
    expect(screen.queryByText(/geteduroam/i)).toBeNull();
  });

  it('android shows the manual Wi-Fi field values (EAP method / Identity)', () => {
    useAppStore.setState({ language: 'en' });
    render(<EduroamTutorial target="android" {...base} />);
    expect(screen.getByText('EAP method')).toBeTruthy();
    expect(screen.getByText('TLS')).toBeTruthy();
    expect(screen.getByText('Identity')).toBeTruthy();
  });

  it('android fills the real identity when the cert CN was read', () => {
    useAppStore.setState({ language: 'en' });
    const { rerender } = render(<EduroamTutorial target="android" {...base} />);
    // Fallback hint before we know the login.
    expect(screen.getByText('your login@mendelu.cz')).toBeTruthy();
    // Real value once identity is resolved.
    rerender(<EduroamTutorial target="android" {...base} identity="xnovak@mendelu.cz" />);
    expect(screen.getByText('xnovak@mendelu.cz')).toBeTruthy();
    expect(screen.queryByText('your login@mendelu.cz')).toBeNull();
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

  it('always shows the final connect-on-campus step, even before download', () => {
    useAppStore.setState({ language: 'en' });
    render(<EduroamTutorial target="mac" {...base} />);
    expect(screen.getByText('Connect to eduroam Wi-Fi on campus')).toBeTruthy();
  });

  it('calls onOpenSettings from the mac open-settings step', () => {
    useAppStore.setState({ language: 'en' });
    const onOpenSettings = vi.fn();
    render(<EduroamTutorial target="mac" {...base} onOpenSettings={onOpenSettings} />);
    fireEvent.click(screen.getByRole('button', { name: /Open Profiles settings/i }));
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
  });
});
