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
});
