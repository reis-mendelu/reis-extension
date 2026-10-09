import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SettingsSheet } from '../SettingsSheet';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Nastavení (spec 2026-10-09): the three things a student sets once —
 * calendar view, language, dark mode — behind one Profile row.
 */
describe('SettingsSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu-dark',
      isThemeLoading: false,
      mobileCalendarView: 'day',
      savedCalendarView: 'day',
      calendarViewChosen: true,
    } as never);
  });

  it('saves the calendar view', () => {
    render(<SettingsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Týden' }));
    expect(useAppStore.getState().savedCalendarView).toBe('week');
    expect(useAppStore.getState().mobileCalendarView).toBe('week');
  });

  it('saving here also answers the first-open chooser', () => {
    useAppStore.setState({ calendarViewChosen: false } as never);
    render(<SettingsSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Den' }));
    expect(useAppStore.getState().calendarViewChosen).toBe(true);
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
