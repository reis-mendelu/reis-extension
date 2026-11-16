import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermTile } from '../../TermTile';
import { TermRowStatus } from '../../mobile/screens/exams/TermRowStatus';
import { useAppStore } from '../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../types/exams';

vi.mock('../../../hooks/data/useWatchdog', () => ({
  useWatchdog: () => ({
    armed: false,
    firing: false,
    feedback: null,
    errorMessage: null,
    toggle: vi.fn(),
  }),
}));

const NOW = new Date(2026, 8, 20, 12, 0);
const TROUBLESHOOT =
  'https://reisapp.cz/navody/prihlaseni-na-zkousku?z=app&utm_source=reis-app#nejde';

const cannot: ExamTerm = {
  id: 't1',
  date: '05.10.2026',
  time: '09:00',
  registrationStart: '01.09.2026 08:00',
  registrationEnd: '01.10.2026 23:59',
  canRegisterNow: false,
  cannotRegister: true,
};
const closed: ExamTerm = {
  id: 't2',
  date: '22.09.2026',
  time: '09:00',
  registrationStart: '01.09.2026 08:00',
  registrationEnd: '15.09.2026 23:59',
  canRegisterNow: false,
};
const open: ExamTerm = {
  id: 't3',
  date: '05.10.2026',
  time: '09:00',
  registrationStart: '01.09.2026 08:00',
  registrationEnd: '01.10.2026 23:59',
  canRegisterNow: true,
  capacity: { occupied: 1, total: 10, raw: '1/10' },
};
const section: ExamSection = {
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [cannot, closed, open],
};

function rowStatus(term: ExamTerm) {
  return render(
    <TermRowStatus
      term={term}
      section={section}
      now={NOW}
      isRegHere={false}
      isProcessing={false}
      onRegister={vi.fn()}
    />
  );
}

/** A term the student cannot get onto: the exam guide's "nejde" section. */
describe('exams — Proč to nejde?', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', now: NOW }));
  afterEach(cleanup);

  it.each([
    ['cannot register', cannot],
    ['closed', closed],
  ])('the phone row links it on a term it %s', (_, term) => {
    rowStatus(term);
    expect(screen.getByRole('link', { name: 'Proč to nejde?' })).toHaveAttribute(
      'href',
      TROUBLESHOOT
    );
  });

  it.each([
    ['cannot register', cannot],
    ['closed', closed],
  ])('the extension tile links it on a term it %s', (_, term) => {
    render(<TermTile term={term} section={section} onSelect={vi.fn()} />);
    // The tile renders a wide and a narrow layout; each carries the link.
    for (const link of screen.getAllByRole('link', { name: 'Proč to nejde?' })) {
      expect(link).toHaveAttribute('href', TROUBLESHOOT);
    }
  });

  it("keeps IS's own reason beside it when IS links one", () => {
    const reason = 'https://is.mendelu.cz/auth/student/terminy_seznam.pl?zobraz_duvod=1';
    rowStatus({ ...cannot, blockReasonUrl: reason });
    expect(screen.getByRole('link', { name: 'Proč?' })).toHaveAttribute('href', reason);
    expect(screen.getByRole('link', { name: 'Proč to nejde?' })).toHaveAttribute(
      'href',
      TROUBLESHOOT
    );
  });

  it('neither offers it on a term that is open', () => {
    rowStatus(open);
    render(<TermTile term={open} section={section} onSelect={vi.fn()} />);
    expect(screen.queryByRole('link', { name: 'Proč to nejde?' })).toBeNull();
  });
});
