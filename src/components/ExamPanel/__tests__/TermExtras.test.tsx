import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermTile } from '../../TermTile';
import { RegisteredTermDetails } from '../RegisteredTermDetails';
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

const term: ExamTerm = {
  id: '343994',
  date: '09.11.2026',
  time: '10:25',
  registrationEnd: '08.11.2026 20:00',
  canRegisterNow: true,
  detailUrl:
    'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=343994;studium=149707;obdobi=812;lang=cz',
  durationMinutes: 45,
};

const section: ExamSection = {
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'registered',
  registeredTerm: { id: term.id, date: term.date, time: term.time, durationMinutes: 45 },
  terms: [term],
};

/**
 * The phone shows every term's length and IS's "Kdo jde se mnou na termín"
 * page. The extension has the same data — its sync attaches the length to every
 * listed term — so it shows them too.
 */
describe('the length and "who is going" on the desktop tree', () => {
  beforeEach(() =>
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      studiumId: '149707',
      obdobiId: '812',
    } as never)
  );
  afterEach(cleanup);

  it('a term tile shows the length of the term', () => {
    render(<TermTile term={term} onSelect={vi.fn()} />);
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  it('a term tile shows no length where IS has none', () => {
    render(<TermTile term={{ ...term, durationMinutes: null }} onSelect={vi.fn()} />);
    expect(screen.queryByText(/min$/)).toBeNull();
  });

  it('a term tile links IS\'s "who is going" page for that term', () => {
    render(<TermTile term={term} onSelect={vi.fn()} />);
    expect(screen.getByRole('link', { name: /Kdo jde se mnou/ })).toHaveAttribute(
      'href',
      'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=343994;spoluzaci=1;studium=149707;obdobi=812;lang=cz'
    );
  });

  it('the registered term shows its length and the same link', () => {
    render(<RegisteredTermDetails section={section} />);
    expect(screen.getByText('45 min')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Kdo jde se mnou/ })).toHaveAttribute(
      'href',
      expect.stringContaining('termin=343994;spoluzaci=1')
    );
  });
});
