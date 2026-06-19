import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { WindowsInstall } from '../WindowsInstall';

afterEach(() => cleanup());

function en() {
  useAppStore.setState({ language: 'en' });
}

describe('WindowsInstall', () => {
  it('shows our geteduroam link, an always-enabled download, and no MENDELU guide', () => {
    en();
    render(<WindowsInstall status="idle" password={null} onDownload={() => {}} />);
    expect(screen.getByText(/geteduroam/i)).toBeTruthy();
    const btn = screen.getByRole('button', { name: /Download eduroam profile/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    // No host detection / no MENDELU guide link anywhere in the panel.
    expect(screen.queryByText(/MENDELU/i)).toBeNull();
    expect(screen.queryByText(/not on Windows/i)).toBeNull();
  });

  it('disables the button only while a profile is being prepared', () => {
    en();
    render(<WindowsInstall status="working" password={null} onDownload={() => {}} />);
    const btn = screen.getByRole('button', { name: /Preparing|Download eduroam profile/i }) as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows the stepper with the .eap-config filename and the password chip when done', () => {
    en();
    render(<WindowsInstall status="done" password="pw123" onDownload={() => {}} />);
    expect(screen.getByText(/eduroam-reis\.eap-config/i)).toBeTruthy();
    expect(screen.getByText('pw123')).toBeTruthy();
  });
});
