import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { RegisteredCard } from '../RegisteredCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { RegisteredExam } from '../../../../../utils/mobile/examRows';

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

const NOW = new Date(2026, 8, 24, 12, 0);
const term = { id: '343995', date: '09.11.2026', time: '11:00', room: 'Q13' };
const other = {
  id: '343994',
  date: '09.11.2026',
  time: '10:25',
  room: 'Q13',
  registrationEnd: '08.11.2026 20:00',
};

const row = {
  subject: { version: 1, id: 'EBC-EKM', name: 'Ekonometrie 1', code: 'EBC-EKM', sections: [] },
  section: {
    id: 's1',
    name: 'Průběžný test 1',
    type: 'test',
    status: 'registered',
    registeredTerm: term,
    terms: [term, other],
  },
  term,
  date: new Date(2026, 10, 9, 11, 0),
  subjectName: 'Ekonometrie 1',
  sectionName: 'Průběžný test 1',
} as unknown as RegisteredExam;

const renderCard = () =>
  render(
    <RegisteredCard
      row={row}
      locale="cs-CZ"
      now={NOW}
      expanded
      onToggle={() => {}}
      isProcessing={false}
      onUnregister={() => {}}
      onRegister={() => {}}
    />
  );

const openMine = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Podrobnosti tvého termínu' }));

/**
 * One "Více" per card: the registered term's, as wide as the card so a thumb
 * finds it. The other terms of the section carried a "Více" each that opened
 * the same form and length again; they are a date, seats and a button now.
 */
describe('RegisteredCard — details', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studiumId: '143752',
      obdobiId: '829',
      examTermDurations: {},
      examNotes: {},
      examNotesLoading: {},
      examNotesError: {},
      lastExamNotesFetchedAt: { [term.id]: Date.now(), [other.id]: Date.now() },
    } as never);
  });

  it('has a single "Více", spanning the card', () => {
    renderCard();
    expect(screen.getAllByText('Více')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Podrobnosti tvého termínu' })).toHaveClass('w-full');
  });

  it('gives the other terms no way to expand', () => {
    renderCard();
    expect(screen.queryByRole('button', { name: /Podrobnosti termínu/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByText(/10:25/));
    expect(screen.queryByTestId('term-details')).not.toBeInTheDocument();
  });

  // With no "Více" of their own, the one fact the other terms still need is
  // how long the student can move onto them.
  it('says on each other term until when it can still be booked', () => {
    renderCard();
    // The date sits in its own brighter span, so match the whole line.
    expect(screen.getByText(/^Přihlášení do/)).toHaveTextContent('Přihlášení do 8. 11. 20:00');
  });

  it('shows the note as "Poznámka ke zkoušce" under Více', () => {
    useAppStore.setState({
      examNotes: { [term.id]: { text: 'S sebou kalkulačku.', isEmphasized: false } },
    } as never);
    renderCard();
    openMine();
    const details = within(screen.getByTestId('term-details'));
    expect(details.getByText('Poznámka ke zkoušce')).toBeInTheDocument();
    expect(details.getByTestId('term-note')).toHaveTextContent('S sebou kalkulačku.');
  });

  it('prints no note heading when the term has no note', () => {
    useAppStore.setState({ examNotes: { [term.id]: null } } as never);
    renderCard();
    openMine();
    expect(screen.queryByText('Poznámka ke zkoušce')).not.toBeInTheDocument();
  });
});
