import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ExamPanel } from '../index';
import { setImpersonating } from '../../Impersonation/__tests__/personaTestState';

vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

/**
 * Admin personas, step D (extension). Exams are personal in IS, so a persona
 * has none; the plain empty state read as "this student has no exams".
 */
beforeEach(() => {
  setImpersonating(false);
  useAppStore.setState({
    language: 'cz',
    firstSyncSettled: true,
    syncLoaded: { exams: true },
    syncStatus: {
      isSyncing: false,
      lastSync: 1,
      error: null,
      handshakeDone: true,
      handshakeTimedOut: false,
    },
    exams: { data: [], status: 'success', error: null },
  } as never);
});
afterEach(cleanup);

it('shows the persona note instead of the empty state while impersonating', () => {
  setImpersonating(true);
  render(<ExamPanel />);
  expect(screen.getByTestId('persona-unavailable')).toHaveTextContent('Zkoušky');
  expect(screen.queryByText('Žádné zkoušky v dohledu')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
});

/** The sync state is the admin's own, not the persona's: it decides nothing here. */
it('shows the note, not a failure, when the admin’s own exams never loaded', () => {
  useAppStore.setState({ syncLoaded: { exams: false } } as never);
  setImpersonating(true);
  render(<ExamPanel />);
  expect(screen.getByTestId('persona-unavailable')).toBeInTheDocument();
  expect(screen.queryByTestId('exams-error')).not.toBeInTheDocument();
});

it('keeps the normal empty state otherwise', () => {
  render(<ExamPanel />);
  expect(screen.getByText('Žádné zkoušky v dohledu')).toBeInTheDocument();
  expect(screen.queryByTestId('persona-unavailable')).not.toBeInTheDocument();
});
