import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ExamsRefresh } from '../ExamsRefresh';
import { useAppStore } from '../../../../../store/useAppStore';

const NOW = new Date(2026, 8, 21, 12, 0);

/**
 * The phone had no way to ask for fresh exam terms. A term that opened or
 * filled up since the last sync stayed wrong on screen until the app was
 * closed and reopened — and during registration that delay is the difference
 * between a seat and none. The desktop has had this button all along
 * (`ExamsFreshness`); the store action behind it is the same one.
 */
describe('ExamsRefresh', () => {
  const trigger = vi.fn();

  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      now: NOW,
      lastExamsFetchedAt: NOW.getTime() - 5 * 60_000,
      examsRefreshing: false,
      triggerExamsRefresh: trigger,
    } as never);
  });
  afterEach(() => {
    cleanup();
    trigger.mockReset();
  });

  it('says how old the terms on screen are', () => {
    render(<ExamsRefresh />);
    expect(screen.getByText('Aktualizováno před 5 minutami')).toBeInTheDocument();
  });

  it('asks IS for fresh terms when tapped', () => {
    render(<ExamsRefresh />);
    fireEvent.click(screen.getByRole('button', { name: 'Obnovit zkoušky' }));
    expect(trigger).toHaveBeenCalledOnce();
  });

  it('cannot be tapped again while a refresh is running, and says so', () => {
    useAppStore.setState({ examsRefreshing: true } as never);
    render(<ExamsRefresh />);
    const button = screen.getByRole('button', { name: 'Obnovit zkoušky' });
    expect(button).toBeDisabled();
    expect(screen.getByText('Aktualizuji…')).toBeInTheDocument();
  });
});
