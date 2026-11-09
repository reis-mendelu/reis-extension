import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { ExamsScreen } from '../ExamsScreen';
import { useAppStore } from '../../../../store/useAppStore';
import { parseExamData } from '../../../../utils/parsers/exams/index';
import {
  SIGNUP_BLOCKED_PAGE,
  SIGNUP_BLOCKED_NOW,
} from '../../../../test/fixtures/examsSignupBlockedPage';
import type { ExamSubject } from '../../../../types/exams';

function withData(data: ExamSubject[]) {
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
    examClassmates: {},
    examClassmatesLoading: {},
    examClassmatesError: {},
    lastExamClassmatesFetchedAt: {},
  } as never);
  // Through the store's own entry point, the way a sync delivers it.
  useAppStore.getState().setExams(data);
}

/**
 * Report #37: her "zápis na cvičení" excursion (ZOO Vyškov, 46/46) sat in
 * IS's "Kam se přihlásit nemohu?" table and reIS showed nothing. From the real
 * row's HTML through the real parser and store to the screen.
 */
describe('a "zápis na cvičení" term on the phone', () => {
  beforeEach(() => withData(parseExamData(SIGNUP_BLOCKED_PAGE, 'cz')));

  it('gets its own group, collapsed, with a count', () => {
    render(<ExamsScreen />);
    const group = screen.getByTestId('exam-group-signup');
    expect(within(group).getByText('Zápisy na cvičení')).toBeInTheDocument();
    expect(within(group).getByText('1')).toBeInTheDocument();
    expect(
      within(group).queryByText('Etologie a welfare hospodářských zvířat')
    ).not.toBeInTheDocument();
  });

  it('is never mixed into the exam groups', () => {
    render(<ExamsScreen />);
    expect(screen.queryByTestId('exam-group-blocked')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exam-group-open')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exam-group-notYetOpen')).not.toBeInTheDocument();
    expect(screen.queryByText('Žádné zkoušky')).not.toBeInTheDocument();
  });

  it('opens to her excursion', () => {
    render(<ExamsScreen />);
    const group = screen.getByTestId('exam-group-signup');
    fireEvent.click(within(group).getByRole('button', { name: /Zápisy na cvičení/ }));
    expect(within(group).getByText('Etologie a welfare hospodářských zvířat')).toBeInTheDocument();
  });
});
