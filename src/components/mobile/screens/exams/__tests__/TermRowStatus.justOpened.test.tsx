import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermRowStatus } from '../TermRowStatus';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../../../types/exams';

const START = new Date(2026, 11, 1, 8, 0, 0);

const term: ExamTerm = {
  id: 't1',
  date: '15.12.2026',
  time: '09:00',
  registrationStart: '01.12.2026 08:00',
  registrationEnd: '14.12.2026 23:59',
  canRegisterNow: false,
  capacity: { occupied: 3, total: 40, raw: '3/40' },
};
const section: ExamSection = {
  id: 's',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [term],
};

function renderAt(offsetMs: number, t: ExamTerm = term) {
  return render(
    <TermRowStatus
      term={t}
      section={section}
      now={new Date(START.getTime() + offsetMs)}
      isRegHere={false}
      isProcessing={false}
      onRegister={() => {}}
    />
  );
}

describe('TermRowStatus the moment registration opens', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));
  afterEach(cleanup);

  it('is not a blank slot while IS has not yet shown the register link', () => {
    const { container } = renderAt(10_000);
    expect(container).not.toBeEmptyDOMElement();
    expect(screen.getByText('otevírá se')).toBeInTheDocument();
  });

  it('never says UZAVŘENO or offers Přihlásit from the clock alone', () => {
    renderAt(10_000);
    expect(screen.queryByText(/uzavřeno/i)).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows the button once IS gives the link', () => {
    renderAt(10_000, { ...term, canRegisterNow: true });
    expect(screen.getByRole('button', { name: 'Přihlásit' })).toBeInTheDocument();
  });

  it('goes back to nothing when IS still has not opened it after the grace window', () => {
    const { container } = renderAt(10 * 60_000);
    expect(container).toBeEmptyDOMElement();
  });
});
