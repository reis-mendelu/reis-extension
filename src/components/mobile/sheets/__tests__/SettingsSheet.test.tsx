import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsSheet } from '../SettingsSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Nastavení: the two things a student sets once — language and dark mode —
 * behind one Profile row. (It also held the calendar view until 2026-10-11,
 * when the phone calendar became Den only.)
 */
describe('SettingsSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu-dark',
      isThemeLoading: false,
    } as never);
  });

  it('flips the theme between mendelu-dark and mendelu', async () => {
    render(<SettingsSheet onClose={vi.fn()} />);
    const themeToggle = screen.getByRole('checkbox', { name: /Tmavý režim/i });
    expect(themeToggle).toBeChecked();
    fireEvent.click(themeToggle);
    await waitFor(() => expect(useAppStore.getState().theme).toBe('mendelu'));
  });

  it('switches the language', async () => {
    render(<SettingsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('English'));
    await waitFor(() => expect(useAppStore.getState().language).toBe('en'));
  });

  it('says the phone has reIS notifications off, and offers the fix', () => {
    useAppStore.setState({ systemNotifications: 'denied' } as never);
    render(<SettingsSheet onClose={vi.fn()} />);
    expect(screen.getByText('Vypnutá')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Zapnout' })).toBeInTheDocument();
  });

  it('shows no notification row before the phone has answered', () => {
    useAppStore.setState({ systemNotifications: 'unknown' } as never);
    render(<SettingsSheet onClose={vi.fn()} />);
    expect(screen.queryByText('Vypnutá')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Zapnout' })).not.toBeInTheDocument();
  });
});
