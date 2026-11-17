import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within, fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ExamPanel } from '../index';
import { parseExamData } from '../../../utils/parsers/exams/index';
import {
  SIGNUP_BLOCKED_PAGE,
  SIGNUP_BLOCKED_NOW,
} from '../../../test/fixtures/examsSignupBlockedPage';

// The real hook reads studium.pl from IS; the panel only needs the link params.
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

beforeEach(() => {
  useAppStore.setState({
    language: 'cz',
    now: SIGNUP_BLOCKED_NOW,
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
  useAppStore.getState().setExams(parseExamData(SIGNUP_BLOCKED_PAGE, 'cz'));
});
afterEach(cleanup);

/** Report #37 on the extension: the same row, the same collapsed group. */
it('shows a "zápis na cvičení" term in its own collapsed group', () => {
  render(<ExamPanel />);
  const group = screen.getByTestId('exam-signup-group');
  expect(within(group).getByText('Zápisy na cvičení')).toBeInTheDocument();
  expect(
    within(group).queryByText('Etologie a welfare hospodářských zvířat')
  ).not.toBeInTheDocument();
  expect(screen.queryByText('Žádné zkoušky v dohledu')).not.toBeInTheDocument();

  fireEvent.click(within(group).getByRole('button', { name: /Zápisy na cvičení/ }));
  expect(within(group).getByText('Etologie a welfare hospodářských zvířat')).toBeInTheDocument();
});
