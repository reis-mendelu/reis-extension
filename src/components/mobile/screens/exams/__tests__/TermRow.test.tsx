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
    expect(toast.error).toHaveBeenCalledWith('Session expired');
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
    expect(toast.error).toHaveBeenCalledWith('Hlídače se nepodařilo aktivovat.');
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
 * Which attempt a term is for decides whether a student may take it at all, and
 * the phone row did not say — the desktop has carried attempt pills on every
 * term for as long as `attemptTypes` has been parsed.
 */
describe('TermRow — attempt type', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    mockedUseWatchdog.mockReturnValue(baseHookState());
  });

  it('names a regular term', () => {
    render(
      <TermRow
        term={{ ...term, attemptTypes: ['regular'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('Řádný')).toBeInTheDocument();
  });

  it('names a retake by its number', () => {
    render(
      <TermRow
        term={{ ...term, attemptTypes: ['retake1'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('1. opravný')).toBeInTheDocument();
  });

  it('lists every attempt a term serves', () => {
    // IS does hand out one term that counts as both.
    render(
      <TermRow
        term={{ ...term, attemptTypes: ['regular', 'retake1'] }}
        section={section}
        now={NOW}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByText('Řádný · 1. opravný')).toBeInTheDocument();
  });

  it('says nothing when IS did not classify the term', () => {
    render(
      <TermRow term={term} section={section} now={NOW} isProcessing={false} onRegister={vi.fn()} />
    );
    expect(screen.queryByText(/opravný|Řádný/)).not.toBeInTheDocument();
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
