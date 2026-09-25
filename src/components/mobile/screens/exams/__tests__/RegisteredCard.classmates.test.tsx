import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
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
const term = {
  id: '343995',
  date: '09.11.2026',
  time: '11:00',
  room: 'Q13',
  sectionForm: 'e-test',
  durationMinutes: 25,
  deregistrationDeadline: '08.11.2026 20:00',
  detailUrl:
    'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=343995;studium=143752;obdobi=829;lang=cz',
};
const other = { id: '343994', date: '09.11.2026', time: '10:25', room: 'Q13' };

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

/** The card's own "Více" chip, which holds the registered term's details. */
const openMine = () =>
  fireEvent.click(screen.getByRole('button', { name: 'Podrobnosti tvého termínu' }));

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

/**
 * "Zatím nikdo ze spolužáků" claimed a fact the app does not have: the
 * classmate list is a separate IS page, and an empty one means "not fetched"
 * as often as it means "nobody". Where there is nobody to name, the card
 * points at IS's own list instead.
 */
describe('RegisteredCard — classmates', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studiumId: '143752',
      obdobiId: '829',
      examClassmates: {},
      examClassmatesLoading: {},
      examClassmatesError: {},
      lastExamClassmatesFetchedAt: { '343995': Date.now() },
    } as never);
  });

  it('does not claim nobody is going', () => {
    useAppStore.setState({ examClassmates: { '343995': [] } } as never);
    renderCard();
    expect(screen.queryByText(/Zatím nikdo/)).not.toBeInTheDocument();
  });

  it('links IS\u2019s own list of the people on the term instead \u2014 once', () => {
    useAppStore.setState({ examClassmates: { '343995': [] } } as never);
    renderCard();
    openMine();
    const links = screen.getAllByRole('link', { name: /Kdo jde se mnou/ });
    expect(links).toHaveLength(1);
    expect(links[0]!.getAttribute('href')).toContain('spoluzaci=1');
  });

  // The count duplicated the "Kdo jde se mnou" button under Více, which opens
  // IS's full list of the people on the term. The button is the one answer.
  it('does not print a classmate count — the Více button is the way to the list', () => {
    useAppStore.setState({
      examClassmates: { '343995': [{ name: 'A' }, { name: 'B' }] },
    } as never);
    renderCard();
    expect(screen.queryByText(/spolužá/)).not.toBeInTheDocument();
    openMine();
    expect(screen.getAllByRole('link', { name: /Kdo jde se mnou/ })).toHaveLength(1);
  });

  /**
   * The card's header IS the registered term — subject, date, room. Listing it
   * again among the terms put the same term on screen twice, one above the
   * other. It stays in `section.terms` (that is what IS gave us), but the card
   * shows the others and hangs its own facts off the header instead.
   */
  it('does not repeat the registered term among the listed ones', () => {
    renderCard();
    const rows = screen.getAllByRole('button', { name: /Podrobnosti termínu/ });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.getAttribute('aria-label')).toContain('10:25');
  });

  it('keeps the registered term’s own facts behind the same "Více" chip', () => {
    renderCard();
    expect(screen.queryByTestId('term-details')).not.toBeInTheDocument();
    openMine();
    const details = screen.getAllByTestId('term-details')[0]!;
    expect(details).toHaveTextContent('e-test');
    expect(details).toHaveTextContent('25 min');
    expect(details).toHaveTextContent('Odhlášení do');
    expect(details).toHaveTextContent('8. 11. 20:00');
  });

  // One place for the room, the same as every term row: under Více. The tile
  // in the strip above still carries it at a glance.
  it('keeps the room out of the header and puts it under Více', () => {
    renderCard();
    const header = screen.getByRole('button', { name: /Ekonometrie 1/, expanded: true });
    expect(header).not.toHaveTextContent('Q13');
    openMine();
    const details = screen.getAllByTestId('term-details')[0]!;
    expect(details).toHaveTextContent('Místnost');
    expect(details).toHaveTextContent('Q13');
  });

  // The "Více" chip sat 8px above a full-width Odhlásit: a thumb reaching for
  // the details could deregister instead. The way out goes last.
  it('puts Odhlásit after the other terms, away from the "Více" chip', () => {
    renderCard();
    const unregister = screen.getByRole('button', { name: 'Odhlásit' });
    const otherRow = screen.getByRole('button', { name: /Podrobnosti termínu.*10:25/ });
    expect(
      otherRow.compareDocumentPosition(unregister) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('builds the people link from the term’s own IS link, not the stored ids', () => {
    useAppStore.setState({ studiumId: 'dev-studium', obdobiId: 'dev-obdobi' } as never);
    renderCard();
    openMine();
    const link = screen.getAllByRole('link', { name: /Kdo jde se mnou/ })[0]!;
    expect(link.getAttribute('href')).toContain('studium=143752');
    expect(link.getAttribute('href')).not.toContain('dev-studium');
  });
});
