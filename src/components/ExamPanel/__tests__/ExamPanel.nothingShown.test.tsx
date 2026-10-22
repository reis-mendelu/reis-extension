import { it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { useAppStore } from '../../../store/useAppStore';
import { ExamPanel } from '../index';

// The real hook reads studium.pl from IS; the panel only needs the link params.
vi.mock('../../../hooks/useUserParams', () => ({ useUserParams: () => ({ params: null }) }));

beforeEach(() =>
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
    // What `stripGroupSignupSections` leaves when "Zápis na cvičení" was the
    // subject's only section: the subject, with nothing in it.
    exams: {
      data: [{ version: 1, id: 'tv', name: 'Tělesná výchova', code: 'TV', sections: [] }],
      status: 'success',
      error: null,
    },
  } as never)
);
afterEach(cleanup);

/** Návrhy #33 on the extension: the panel's last branch was `null`, a blank body. */
it('says there are no exams when a subject leaves nothing to show', () => {
  render(<ExamPanel />);
  expect(screen.getByText('Žádné zkoušky v dohledu')).toBeInTheDocument();
});
