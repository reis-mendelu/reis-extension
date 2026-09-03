import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SheetHost } from '../SheetHost';
import { useAppStore } from '../../../../store/useAppStore';

/**
 * Search was a bottom-nav tab ("Student") — a fifth of the app's primary
 * navigation spent on a text field, on a screen whose entire content was that
 * field and its results. It becomes a sheet opened from the header, which is
 * what frees the tab slot and puts search on every tab at once.
 *
 * The sheet is the Student screen's body, moved: the same people/subjects
 * toggle, the same `useSearch`, the same recent-people list, and the same two
 * destinations (a subject drawer, a person card) pushed ON TOP of it.
 */
describe('SearchSheet', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      mobileSheets: [],
      recentPeople: [],
      subjects: { version: 1, lastUpdated: '', data: {} },
      syncStatus: {
        isSyncing: false,
        lastSync: 1,
        error: null,
        handshakeDone: true,
        handshakeTimedOut: false,
      },
    } as never);
  });

  it('is rendered by SheetHost for the search kind', () => {
    useAppStore.setState({ mobileSheets: [{ kind: 'search' }] } as never);
    render(<SheetHost />);
    expect(screen.getByTestId('search-sheet')).toBeInTheDocument();
  });

  // Tabs, not buttons: the mode toggle is a `role="tablist"` segmented control,
  // and `aria-selected` is what says which mode is live.
  it('offers the people and subjects modes, with people selected first', () => {
    useAppStore.setState({ mobileSheets: [{ kind: 'search' }] } as never);
    render(<SheetHost />);
    const people = screen.getByRole('tab', { name: 'Lidé' });
    expect(people).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Předměty' })).toHaveAttribute('aria-selected', 'false');
  });

  it('takes a query', () => {
    useAppStore.setState({ mobileSheets: [{ kind: 'search' }] } as never);
    render(<SheetHost />);
    const input = screen.getByLabelText('Hledej člověka…');
    fireEvent.change(input, { target: { value: 'Novák' } });
    expect(input).toHaveValue('Novák');
  });

  it('closes on its own backdrop, leaving nothing behind', () => {
    useAppStore.setState({ mobileSheets: [{ kind: 'search' }] } as never);
    render(<SheetHost />);
    fireEvent.click(screen.getByTestId('sheet-backdrop'));
    expect(useAppStore.getState().mobileSheets).toEqual([]);
  });
});
