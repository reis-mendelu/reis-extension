import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProfileSheet } from '../ProfileSheet';
import { useAppStore } from '../../../../store/useAppStore';

describe('ProfileSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      theme: 'mendelu-dark',
      isThemeLoading: false,
      fullName: 'Kryštof Janda',
      studyPlanDual: null,
      hiddenItems: {
        courses: [],
        events: [{ id: 'ev1', courseCode: 'ALG', courseName: 'Algoritmizace', date: '20260401' }],
      },
    } as never);
  });

  it('flips the theme between mendelu-dark and mendelu', async () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    const themeToggle = screen.getByRole('checkbox', { name: /Tmavý režim/i });
    expect(themeToggle).toBeChecked();

    fireEvent.click(themeToggle);

    await waitFor(() => expect(useAppStore.getState().theme).toBe('mendelu'));
  });

  it('switches the language', async () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('English'));
    await waitFor(() => expect(useAppStore.getState().language).toBe('en'));
  });

  it('offers no calendar-sync toggle', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    // The Outlook calendar mirror was removed once the phone app covered it.
    // Asserted on the visible label rather than the hook, so the test fails if
    // the control is ever re-rendered from any source.
    expect(screen.queryByText(/Synchronizace kalendáře/i)).toBeNull();
    expect(screen.queryByText(/Rozvrh a zkoušky do Outlooku/i)).toBeNull();
  });

  it('opens the eduroam sheet from settings in one tap', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    fireEvent.click(screen.getByText('Eduroam'));
    expect(useAppStore.getState().mobileSheets).toEqual([{ kind: 'eduroam' }]);
  });

  it('shows a hidden event and restores it, removing it from the hidden list', () => {
    render(<ProfileSheet onClose={vi.fn()} />);
    // HiddenItemsSection starts collapsed - expand it first.
    fireEvent.click(screen.getByText('Skryté položky'));
    fireEvent.click(screen.getByTitle('Obnovit'));
    expect(useAppStore.getState().hiddenItems.events).toEqual([]);
  });
});
