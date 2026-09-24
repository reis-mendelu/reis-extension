import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { toast } from 'sonner';
import { TermRow } from '../TermRow';
import { useWatchdog } from '../../../../../hooks/data/useWatchdog';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../../../types/exams';

vi.mock('../../../../../hooks/data/useWatchdog', () => ({
  useWatchdog: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
  },
}));

const mockedUseWatchdog = vi.mocked(useWatchdog);

const NOW = new Date(2026, 8, 20, 12, 0);

const term: ExamTerm = {
  id: 't1',
  date: '20.5.2026',
  time: '10:00',
  watchdogUrl: 'https://is.mendelu.cz/watchdog?aktivace=1',
};

const section: ExamSection = {
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [term],
};

function baseHookState() {
  return {
    armed: false,
    firing: false,
    feedback: null as 'activated' | 'deactivated' | 'failed' | null,
    errorMessage: null as string | null,
    toggle: vi.fn(),
  };
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TermRow', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
  });

  it('shows a success toast when the watchdog is activated', () => {
    mockedUseWatchdog.mockReturnValue({ ...baseHookState(), armed: true, feedback: 'activated' });
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(toast.success).toHaveBeenCalledWith(
      'Hlídač aktivován. IS pošle e-mail, až bude termín volný.'
    );
  });

  it('shows an info toast when the watchdog is deactivated', () => {
    mockedUseWatchdog.mockReturnValue({
      ...baseHookState(),
      armed: false,
      feedback: 'deactivated',
    });
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(toast.info).toHaveBeenCalledWith('Hlídač deaktivován.');
  });

  it('shows an error toast with the specific message when the toggle fails, instead of silently reverting', () => {
    mockedUseWatchdog.mockReturnValue({
      ...baseHookState(),
      feedback: 'failed',
      errorMessage: 'Session expired',
    });
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(toast.error).toHaveBeenCalledWith(
      'Session expired',
      expect.objectContaining({ duration: 10_000 })
    );
  });

  it('falls back to the generic failure message when the toggle fails with no specific error', () => {
    mockedUseWatchdog.mockReturnValue({
      ...baseHookState(),
      feedback: 'failed',
      errorMessage: null,
    });
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(toast.error).toHaveBeenCalledWith(
      'Hlídače se nepodařilo aktivovat.',
      expect.objectContaining({ duration: 10_000 })
    );
  });

  it('offers Nahlásit on a failed toggle, prefilled with our own title', () => {
    useAppStore.setState({ reportOpen: false, reportPrefill: null } as never);
    mockedUseWatchdog.mockReturnValue({
      ...baseHookState(),
      feedback: 'failed',
      errorMessage: 'IS says no',
    });
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    const opts = vi.mocked(toast.error).mock.calls[0]?.[1] as unknown as {
      action: { label: string; onClick: () => void };
    };
    expect(opts.action.label).toBe('Nahlásit');
    opts.action.onClick();
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Zkoušky: akce selhala' });
  });

  it('does not toast when there is no feedback yet', () => {
    mockedUseWatchdog.mockReturnValue(baseHookState());
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.info).not.toHaveBeenCalled();
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('still renders the watch toggle button', () => {
    mockedUseWatchdog.mockReturnValue(baseHookState());
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(screen.getByTestId('watch-toggle')).toBeInTheDocument();
  });
});

/**
 * The trailing slot is the row's one answer to "can I act on this?". It used to
 * go blank for a term IS has not opened yet, which read as "nothing here" when
 * the truth was "not yet" — and the date that resolved it lived only in the
 * card header, gone the moment the card was scrolled past.
 */
describe('TermRow — registration not open yet', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    mockedUseWatchdog.mockReturnValue(baseHookState());
  });

  const notOpenYet: ExamTerm = {
    ...term,
    canRegisterNow: false,
    registrationStart: '21.09.2026 13:00',
  };

  it('says when registration opens, in the slot the register button will take', () => {
    render(
      <TermRow
        term={notOpenYet}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    // Two lines so the slot stays as narrow as the button that will replace it.
    expect(screen.getByText('otevírá se')).toBeInTheDocument();
    expect(screen.getByText('21. 9. 13:00')).toBeInTheDocument();
  });

  it('paints that label warning, not the success green a bookable term earns', () => {
    render(
      <TermRow
        term={notOpenYet}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('otevírá se').parentElement?.className).toContain('text-warning');
  });

  it('gives way to the register button once IS opens registration', () => {
    render(
      <TermRow
        term={{ ...notOpenYet, canRegisterNow: true }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Přihlásit' })).toBeInTheDocument();
    expect(screen.queryByText(/otevírá se/)).not.toBeInTheDocument();
  });

  it('stays quiet when the opening moment is already past', () => {
    // Registration that opened and closed again is not "opening on 1. 9." — the
    // date is real but the sentence it would form is false.
    render(
      <TermRow
        term={{ ...notOpenYet, registrationStart: '01.09.2026 13:00' }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.queryByText(/otevírá se/)).not.toBeInTheDocument();
  });
});

/**
 * Which attempt a term is for decides whether a student may take it at all.
 * It is a small coloured badge — Ř (řádný), 1, 2, 3 for the retakes — AFTER
 * the seat count: "volno 66 z 66 (Ř)". The badge is the glance, the full name
 * rides in its label for a screen reader and a long-press.
 */
describe('TermRow — attempt type', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    mockedUseWatchdog.mockReturnValue(baseHookState());
  });

  const withSeats = { ...term, capacity: { occupied: 0, total: 66, raw: '0/66' } };

  it('shows a regular term as a small Ř badge, named in full for assistive tech', () => {
    render(
      <TermRow
        term={{ ...withSeats, attemptTypes: ['regular'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    const badge = screen.getByLabelText('Řádný');
    expect(badge).toHaveTextContent('Ř');
    expect(badge.className).toContain('bg-success');
  });

  it('numbers the retakes and colours them by how late they are', () => {
    render(
      <TermRow
        term={{ ...withSeats, attemptTypes: ['retake1', 'retake2'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByLabelText('1. opravný')).toHaveTextContent('1');
    expect(screen.getByLabelText('1. opravný').className).toContain('bg-warning');
    expect(screen.getByLabelText('2. opravný')).toHaveTextContent('2');
    expect(screen.getByLabelText('2. opravný').className).toContain('bg-error');
  });

  // A term can count as one attempt or as all of them at once — IS lists
  // "řádný, 1. opravný, 2. opravný" on a single slot. Every one gets its badge,
  // in attempt order, and the seat count keeps its place in front.
  it('shows every attempt a term counts as, in order, after the seats', () => {
    render(
      <TermRow
        term={{ ...withSeats, attemptTypes: ['regular', 'retake1', 'retake2'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    const badges = screen.getAllByRole('img');
    expect(badges.map((b) => b.textContent)).toEqual(['Ř', '1', '2']);
    const seats = screen.getByText('volno 66 z 66');
    expect(
      seats.compareDocumentPosition(badges[0]!) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it('puts the seat count first and the badge after it', () => {
    render(
      <TermRow
        term={{ ...withSeats, attemptTypes: ['regular'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    const seats = screen.getByText('volno 66 z 66');
    const badge = screen.getByLabelText('Řádný');
    // DOCUMENT_POSITION_FOLLOWING: the badge comes after the seats.
    expect(seats.compareDocumentPosition(badge) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('says nothing when IS did not classify the term', () => {
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(screen.queryByLabelText(/opravný|Řádný/)).not.toBeInTheDocument();
  });
});

describe('TermRow — seat count colour', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    mockedUseWatchdog.mockReturnValue(baseHookState());
  });

  it('reads success while seats are left', () => {
    render(
      <TermRow
        term={{ ...term, capacity: { occupied: 10, total: 66, raw: '10/66' } }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('volno 56 z 66').className).toContain('text-success');
  });

  it('reads error once the last seat goes', () => {
    render(
      <TermRow
        term={{ ...term, capacity: { occupied: 66, total: 66, raw: '66/66' } }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('volno 0 z 66').className).toContain('text-error');
  });
});

/**
 * A term from "Kam se přihlásit nemohu?". Its registration may well open later
 * on paper, but the student still cannot take it — so the slot says so, and
 * links IS's own explanation, instead of "otevírá se" or a button.
 */
describe('TermRow — a term the student cannot sign up for', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    mockedUseWatchdog.mockReturnValue(baseHookState());
  });

  const blocked: ExamTerm = {
    ...term,
    watchdogUrl: undefined,
    cannotRegister: true,
    canRegisterNow: false,
    registrationStart: '09.11.2026 15:00',
    blockReasonUrl:
      'https://is.mendelu.cz/auth/student/terminy_seznam.pl?termin=t1;zobraz_duvod=1;lang=cz',
  };

  it('says it cannot be registered, not when it opens', () => {
    render(
      <TermRow
        term={blocked}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('nelze se přihlásit')).toBeInTheDocument();
    expect(screen.queryByText('otevírá se')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Přihlásit' })).not.toBeInTheDocument();
  });

  it('links the reason IS gives', () => {
    render(
      <TermRow
        term={blocked}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    const link = screen.getByRole('link', { name: /Proč/ });
    expect(link).toHaveAttribute('href', blocked.blockReasonUrl);
    expect(link).toHaveAttribute('target', '_blank');
  });
});

/**
 * Registration that has already closed. The desktop tile marks it "UZAVŘENO"
 * and disables the tile; the row had nothing in its trailing slot at all,
 * which reads as "nothing here" rather than "too late".
 */
describe('TermRow — registration already closed', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    mockedUseWatchdog.mockReturnValue(baseHookState());
  });

  it('says it is closed instead of leaving the slot empty', () => {
    render(
      <TermRow
        term={{ ...term, watchdogUrl: undefined, registrationEnd: '19.09.2026 23:59' }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('uzavřeno')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Přihlásit' })).not.toBeInTheDocument();
  });

  it('keeps the register button while the deadline is still ahead', () => {
    render(
      <TermRow
        term={{ ...term, canRegisterNow: true, registrationEnd: '21.09.2026 23:59' }}
        section={section}
        now={new Date(2026, 8, 20, 12, 0)}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: 'Přihlásit' })).toBeInTheDocument();
    expect(screen.queryByText('uzavřeno')).not.toBeInTheDocument();
  });
});
