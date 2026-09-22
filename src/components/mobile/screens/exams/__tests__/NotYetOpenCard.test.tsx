import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { NotYetOpenCard } from '../NotYetOpenCard';
import { useWatchdog } from '../../../../../hooks/data/useWatchdog';
import { useAppStore } from '../../../../../store/useAppStore';
import type { OpenExam } from '../../../../../utils/mobile/examRows';

vi.mock('../../../../../hooks/data/useWatchdog', () => ({
  useWatchdog: vi.fn(),
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

const NOW = new Date(2026, 8, 20, 12, 0);

const row = {
  subject: { id: 'sub1' },
  section: {
    id: 's1',
    name: 'Průběžný test 1',
    type: 'exam',
    status: 'open',
    terms: [
      {
        id: 't1',
        date: '07.12.2026',
        time: '10:25',
        room: 'Studovna PEF (ČP)',
        canRegisterNow: false,
        registrationStart: '21.09.2026 13:00',
        capacity: { occupied: 0, total: 66, raw: '0/66' },
      },
    ],
  },
  subjectName: 'Ekonometrie 1',
  sectionName: 'Průběžný test 1',
} as unknown as OpenExam;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('NotYetOpenCard', () => {
  beforeEach(() => {
    useAppStore.setState({ language: 'cz' } as never);
    vi.mocked(useWatchdog).mockReturnValue({
      armed: false,
      firing: false,
      feedback: null,
      errorMessage: null,
      toggle: vi.fn(),
    });
  });

  function renderCard() {
    return render(
      <NotYetOpenCard
        row={row}
        now={NOW}
        expanded
        onToggle={vi.fn()}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
  }

  it('leads with the subject, not the assessment type', () => {
    // A student scanning exam season recognises "Ekonometrie 1"; "Průběžný
    // test 1" is a label three different subjects can wear in the same list.
    renderCard();
    const lines = screen.getAllByText(/Ekonometrie 1|Průběžný test 1/);
    expect(lines[0]).toHaveTextContent('Ekonometrie 1');
    expect(lines[1]).toHaveTextContent('Průběžný test 1');
  });

  it('leaves the opening moment to the term rows and keeps only the term count in the header', () => {
    renderCard();
    // One mention, and it is the row's — the header no longer repeats it.
    expect(screen.getAllByText(/otevírá se/)).toHaveLength(1);
    expect(screen.getByText('1 termín')).toBeInTheDocument();
  });
});
