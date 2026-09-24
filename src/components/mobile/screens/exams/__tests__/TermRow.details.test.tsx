import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { TermRow } from '../TermRow';
import { useWatchdog } from '../../../../../hooks/data/useWatchdog';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../../../types/exams';

vi.mock('../../../../../hooks/data/useWatchdog', () => ({ useWatchdog: vi.fn() }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const NOW = new Date(2026, 8, 22, 12, 0);

const term: ExamTerm = {
  id: '343995',
  date: '09.11.2026',
  time: '11:00',
  room: 'Q01',
  sectionFormCs: 'e-test',
  registrationEnd: '08.11.2026 20:00',
  deregistrationDeadline: '07.11.2026 18:00',
  canRegisterNow: true,
};

const openSection: ExamSection = {
  id: 's1',
  name: 'průběžný test 1',
  type: 'test',
  status: 'available',
  terms: [term],
};

const registeredSection: ExamSection = {
  ...openSection,
  status: 'registered',
  registeredTerm: { id: term.id, date: term.date, time: term.time, durationMinutes: 25 },
};

const renderRow = (section: ExamSection) =>
  render(
    <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
  );

const openDetails = () =>
  fireEvent.click(screen.getByRole('button', { name: /9\. 11\./, expanded: false }));

/**
 * Each term opens on its own: registration and deregistration deadlines differ
 * term by term (four Python terms can close on four different days), so they
 * cannot be shown once per subject — only under the term they belong to.
 */
describe('TermRow — details', () => {
  beforeEach(() => {
    vi.mocked(useWatchdog).mockReturnValue({
      armed: false,
      firing: false,
      feedback: null,
      errorMessage: null,
      toggle: vi.fn(),
    } as never);
    useAppStore.setState({
      language: 'cz',
      studiumId: '143752',
      obdobiId: '829',
      examTermDurations: {},
      examNotes: {},
      examNotesLoading: {},
      examNotesError: {},
      lastExamNotesFetchedAt: { [term.id]: Date.now() },
    } as never);
  });
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // The bare chevron did not say a tap gets you anything: a labelled "Více"
  // chip does, and it is a target a thumb can find.
  it('are offered by a labelled "Více" chip that becomes "Méně" when open', () => {
    renderRow(openSection);
    expect(screen.getByText('Více')).toBeInTheDocument();
    openDetails();
    expect(screen.getByText('Méně')).toBeInTheDocument();
    expect(screen.queryByText('Více')).not.toBeInTheDocument();
  });

  it('stay hidden until the term is tapped', () => {
    renderRow(openSection);
    expect(screen.queryByTestId('term-details')).not.toBeInTheDocument();
    openDetails();
    expect(screen.getByTestId('term-details')).toBeInTheDocument();
  });

  it('show the form of the term', () => {
    renderRow(openSection);
    openDetails();
    expect(screen.getByText('Forma termínu')).toBeInTheDocument();
    expect(screen.getByText('e-test')).toBeInTheDocument();
  });

  // One deadline per term, the one the student can act on — see
  // utils/mobile/examDeadline.
  it('show until when you can still register for a term you can book', () => {
    render(
      <TermRow
        term={{ ...term, canRegisterNow: true }}
        section={openSection}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    openDetails();
    expect(screen.getByText('Přihlášení do')).toBeInTheDocument();
    expect(screen.getByText('8. 11. 20:00')).toBeInTheDocument();
    expect(screen.queryByText('Odhlášení do')).not.toBeInTheDocument();
  });

  it('show until when you can still deregister from your own term', () => {
    renderRow(registeredSection);
    openDetails();
    expect(screen.getByText('Odhlášení do')).toBeInTheDocument();
    expect(screen.getByText('7. 11. 18:00')).toBeInTheDocument();
    expect(screen.queryByText('Přihlášení do')).not.toBeInTheDocument();
  });

  // Not the opening moment: the row's own slot already says "otevírá se …".
  it('show the closing deadline on a term whose registration has not opened', () => {
    render(
      <TermRow
        term={{ ...term, canRegisterNow: false, registrationStart: '01.11.2026 13:00' }}
        section={openSection}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    openDetails();
    const details = within(screen.getByTestId('term-details'));
    expect(details.getByText('Přihlášení do')).toBeInTheDocument();
    expect(details.getByText('8. 11. 20:00')).toBeInTheDocument();
    expect(details.queryByText('Přihlášení od')).not.toBeInTheDocument();
  });

  it('show the length the sync attached to the term', () => {
    render(
      <TermRow
        term={{ ...term, durationMinutes: 45 }}
        section={openSection}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    openDetails();
    expect(screen.getByText('45 min')).toBeInTheDocument();
  });

  // The detail page is fetched for the length alone — the phone shows no
  // Poznámka — so a length the sync already has makes the request pointless.
  it('do not fetch the detail page when the sync already attached the length', () => {
    const fetchExamNotePriority = vi.fn();
    useAppStore.setState({ fetchExamNotePriority } as never);
    render(
      <TermRow
        term={{ ...term, durationMinutes: 45 }}
        section={openSection}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    openDetails();
    expect(fetchExamNotePriority).not.toHaveBeenCalled();
  });

  // null is "IS had none at the last sync"; a teacher can have filled it in
  // since, and opening the term is where the student asks.
  it.each([undefined, null])('fetch the detail page when the length is %s', (durationMinutes) => {
    const fetchExamNotePriority = vi.fn();
    useAppStore.setState({ fetchExamNotePriority } as never);
    render(
      <TermRow
        term={{ ...term, durationMinutes }}
        section={openSection}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    openDetails();
    expect(fetchExamNotePriority).toHaveBeenCalledWith(term.id);
  });

  // The room is already on the term's own line.
  it('do not repeat the room as a "Místo konání" row', () => {
    renderRow(openSection);
    openDetails();
    expect(screen.queryByText('Místo konání')).not.toBeInTheDocument();
  });

  it('show the length read on demand for a term the sync did not enrich', () => {
    useAppStore.setState({ examTermDurations: { [term.id]: 90 } } as never);
    renderRow(openSection);
    openDetails();
    expect(screen.getByText('Délka trvání')).toBeInTheDocument();
    expect(screen.getByText('90 min')).toBeInTheDocument();
  });

  it('link "Kdo jde se mnou na termín?" to the classmates list in IS', () => {
    renderRow(registeredSection);
    openDetails();
    const link = screen.getByRole('link', { name: /Kdo jde se mnou na termín/ });
    expect(link).toHaveAttribute('target', '_blank');
    const href = link.getAttribute('href')!;
    expect(href).toContain('/auth/student/terminy_info.pl?termin=343995');
    expect(href).toContain('spoluzaci=1');
    expect(href).toContain('studium=143752');
    expect(href).toContain('obdobi=829');
  });

  // The ids in IS's own Podrobnosti link are the real ones. The store's can be
  // placeholders (the dev webapp's are "dev-studium"), which IS answers with
  // "Nekorektní použití aplikace".
  it('build "Kdo jde se mnou" from the own IS link of the term when it has one', () => {
    render(
      <TermRow
        term={{
          ...term,
          detailUrl:
            'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=343995;studium=555;obdobi=777;lang=cz',
        }}
        section={registeredSection}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    openDetails();
    expect(screen.getByRole('link', { name: /Kdo jde se mnou/ })).toHaveAttribute(
      'href',
      'https://is.mendelu.cz/auth/student/terminy_info.pl?termin=343995;spoluzaci=1;studium=555;obdobi=777;lang=cz'
    );
  });

  // No map button here: the room belongs to the map tab, and a second way in
  // from every term row was one the student did not ask for.
  it('offer no map button', () => {
    renderRow(openSection);
    openDetails();
    expect(screen.queryByText(/Ukázat na mapě/)).not.toBeInTheDocument();
  });
});
