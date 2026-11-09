import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, within, cleanup } from '@testing-library/react';
import { OpenCard } from '../OpenCard';
import { NotYetOpenCard } from '../NotYetOpenCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { OpenExam } from '../../../../../utils/mobile/examRows';
import type { ExamTerm } from '../../../../../types/exams';

vi.mock('../../../../../hooks/data/useWatchdog', () => ({
  useWatchdog: () => ({
    armed: false,
    firing: false,
    feedback: null,
    errorMessage: null,
    toggle: vi.fn(),
  }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const NOW = new Date(2026, 11, 1, 12, 0);

function makeTerm(i: number, extra: Partial<ExamTerm> = {}): ExamTerm {
  return {
    id: `t${i}`,
    date: `${String(10 + i).padStart(2, '0')}.12.2026`,
    time: '08:00',
    room: 'Q01',
    sectionFormCs: 'písemná',
    durationMinutes: 90,
    capacity: { occupied: 0, total: 74, raw: '0/74' },
    registrationEnd: `${String(9 + i).padStart(2, '0')}.12.2026 20:00`,
    deregistrationDeadline: `${String(9 + i).padStart(2, '0')}.12.2026 20:00`,
    ...extra,
  } as ExamTerm;
}

function makeRow(terms: ExamTerm[]): OpenExam {
  return {
    subject: { id: 'sub1' },
    section: { id: 's1', name: 'zkouška', type: 'exam', status: 'open', terms },
    subjectName: 'Podniková ekonomika',
    sectionName: 'zkouška',
  } as unknown as OpenExam;
}

const notYetOpen = (i: number, extra: Partial<ExamTerm> = {}) =>
  makeTerm(i, { canRegisterNow: false, registrationStart: '14.12.2026 09:00', ...extra });
const open = (i: number, extra: Partial<ExamTerm> = {}) =>
  makeTerm(i, { canRegisterNow: true, ...extra });

const cards = {
  OpenCard: (row: OpenExam) => (
    <OpenCard
      row={row}
      now={NOW}
      expanded
      onToggle={vi.fn()}
      isProcessing={false}
      onRegister={vi.fn()}
    />
  ),
  NotYetOpenCard: (row: OpenExam) => (
    <NotYetOpenCard
      row={row}
      now={NOW}
      expanded
      onToggle={vi.fn()}
      isProcessing={false}
      onRegister={vi.fn()}
    />
  ),
};
const termsFor = { OpenCard: open, NotYetOpenCard: notYetOpen };

const NOTE = { text: 'S sebou kalkulačku.', isEmphasized: false };
const IDS = ['t1', 't2', 't3', 't4', 't5'];

const openDetails = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Podrobnosti zkoušky' }));

/**
 * One "Více" per subject card, as under a registered card: ten rows each with
 * a "Více" opening the same form, length and teacher's note was the same
 * answer ten times. The rows keep what differs between them inline.
 */
describe.each(['OpenCard', 'NotYetOpenCard'] as const)('%s — one Více per card', (name) => {
  const term = termsFor[name];
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studiumId: '143752',
      obdobiId: '829',
      examTermDurations: {},
      // Every term's note already read, so opening the card fetches nothing.
      examNotes: Object.fromEntries(IDS.map((id) => [id, NOTE])),
      examNotesLoading: {},
      examNotesError: {},
      lastExamNotesFetchedAt: Object.fromEntries(IDS.map((id) => [id, Date.now()])),
    } as never);
  });
  afterEach(() => {
    cleanup();
  });

  it('has exactly one Více, spanning the card, and no row expands', () => {
    render(cards[name](makeRow([1, 2, 3, 4, 5].map((i) => term(i)))));
    expect(screen.getAllByText('Více')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Podrobnosti zkoušky' })).toHaveClass('w-full');
    expect(screen.queryByRole('button', { name: /Podrobnosti termínu/ })).not.toBeInTheDocument();
  });

  // The deadlines left the details because they are per term; each row has to
  // carry its own instead, or the card would lose them altogether.
  it('says on every row until when that term takes registrations', () => {
    render(cards[name](makeRow([1, 2, 3].map((i) => term(i)))));
    const lines = screen.getAllByText(/^Přihlášení do/);
    expect(lines.map((l) => l.textContent)).toEqual([
      'Přihlášení do 10. 12. 20:00',
      'Přihlášení do 11. 12. 20:00',
      'Přihlášení do 12. 12. 20:00',
    ]);
  });

  it('opens the subject-level facts and the note, never one term’s deadline or classmates', () => {
    render(cards[name](makeRow([1, 2, 3].map((i) => term(i)))));
    openDetails();
    const details = within(screen.getByTestId('term-details'));
    expect(details.getByText('písemná')).toBeInTheDocument();
    expect(details.getByText(/90/)).toBeInTheDocument();
    expect(details.getByTestId('term-note')).toHaveTextContent('S sebou kalkulačku.');
    expect(details.queryByText(/Přihlášení do|Odhlášení do|Přihlášení od/)).toBeNull();
    expect(details.queryByText(/Kdo jde/)).toBeNull();
  });

  it('shows the room only when every term shares it', () => {
    render(cards[name](makeRow([1, 2, 3].map((i) => term(i)))));
    openDetails();
    expect(within(screen.getByTestId('term-details')).getByText('Q01')).toBeInTheDocument();
    cleanup();
    render(cards[name](makeRow([term(1), term(2, { room: 'Q02' }), term(3)])));
    openDetails();
    expect(within(screen.getByTestId('term-details')).queryByText(/Q0/)).toBeNull();
  });

  // Review (cubic, CodeRabbit): form, length and note are per term in IS, so
  // the first term's values must not be shown as the whole card's.
  it('leaves out a form, length or note the terms disagree on', () => {
    useAppStore.setState({
      examNotes: {
        ...useAppStore.getState().examNotes,
        t2: { text: 'Jiná.', isEmphasized: false },
      },
    } as never);
    render(
      cards[name](makeRow([term(1), term(2, { sectionFormCs: 'ústní', durationMinutes: 60 })]))
    );
    openDetails();
    const details = within(screen.getByTestId('term-details'));
    expect(details.queryByText(/písemná|ústní/)).toBeNull();
    expect(details.queryByText(/min/)).toBeNull();
    expect(details.queryByTestId('term-note')).toBeNull();
    expect(details.getByText('Q01')).toBeInTheDocument();
  });

  // Review (cubic): a page that failed to load is not IS saying "nothing".
  it('says a read failed rather than that IS gives nothing', () => {
    const bare = { sectionFormCs: undefined, durationMinutes: null };
    useAppStore.setState({
      examNotes: { t1: null },
      examNotesError: { t2: 'HTTP 500' },
    } as never);
    render(cards[name](makeRow([term(1, bare), term(2, { ...bare, room: 'Q02' })])));
    openDetails();
    const details = screen.getByTestId('term-details');
    expect(details).toHaveTextContent('Některé podrobnosti se nepodařilo načíst.');
    expect(details).not.toHaveTextContent('nic dalšího neuvádí');
  });

  it('says IS gives nothing more instead of opening an empty strip', () => {
    useAppStore.setState({ examNotes: { t1: null, t2: null } } as never);
    const bare = { sectionFormCs: undefined, durationMinutes: null };
    render(cards[name](makeRow([term(1, bare), term(2, { ...bare, room: 'Q02' })])));
    openDetails();
    expect(screen.getByTestId('term-details')).toHaveTextContent('IS k tomu nic dalšího neuvádí.');
  });
});
