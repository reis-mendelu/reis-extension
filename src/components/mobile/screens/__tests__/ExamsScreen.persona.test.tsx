import { it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import cs from '../../../../i18n/locales/cs.json';
import { setImpersonating } from '../../../Impersonation/__tests__/personaTestState';

/**
 * Admin personas, step D (phone/iPad). Exams are personal in IS, so a persona
 * has none; the plain empty state read as "this student has no exams".
 */
beforeEach(() => {
  setImpersonating(false);
  useAppStore.setState({
    language: 'cz',
    now: new Date(2026, 10, 27, 10, 0),
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
    examClassmates: {},
    examClassmatesLoading: {},
    examClassmatesError: {},
    lastExamClassmatesFetchedAt: {},
  } as never);
});
afterEach(cleanup);

it('shows the persona note under the header while impersonating', () => {
  setImpersonating(true);
  render(<ExamsScreen />);
  expect(screen.getByTestId('persona-unavailable')).toHaveTextContent('Zkoušky');
  expect(screen.getByTestId('exams-screen')).toContainElement(
    screen.getByTestId('persona-unavailable')
  );
  expect(screen.queryByText('Žádné zkoušky')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
  // The refresh would refetch the admin's own exams.
  expect(screen.queryByRole('button', { name: cs.mobile.exams.refresh })).toBeNull();
});

/** The sync state is the admin's own, not the persona's: it decides nothing here. */
it('shows the note, not a failure, when the admin’s own exams never loaded', () => {
  useAppStore.setState({ syncLoaded: { exams: false } } as never);
  setImpersonating(true);
  render(<ExamsScreen />);
  expect(screen.getByTestId('persona-unavailable')).toBeInTheDocument();
  expect(screen.queryByTestId('exams-error')).not.toBeInTheDocument();
});

it('keeps the normal empty state otherwise', () => {
  render(<ExamsScreen />);
  expect(screen.getByText('Žádné zkoušky')).toBeInTheDocument();
  expect(screen.queryByTestId('persona-unavailable')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button', { name: cs.mobile.exams.refresh }).length).toBeGreaterThan(
    0
  );
});
