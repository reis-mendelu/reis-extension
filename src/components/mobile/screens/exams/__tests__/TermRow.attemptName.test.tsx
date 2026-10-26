import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermRow } from '../TermRow';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../../../../types/exams';

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

const term: ExamTerm = {
  id: 't1',
  date: '20.5.2026',
  time: '10:00',
  attemptTypes: ['retake2'],
};

const section: ExamSection = {
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [term],
};

/**
 * The phone's twin of TermTile.attemptName: the row's details button carries
 * an explicit `aria-label`, which hides the AttemptBadge's own `role="img"`
 * name. The legend under the card says which types exist, not which term is
 * which, so the row has to say it itself.
 */
describe('TermRow names the attempts it counts as', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz' } as never));
  afterEach(cleanup);

  it('includes the attempt type in the details button’s name', () => {
    render(
      <TermRow
        term={term}
        section={section}
        now={new Date(2026, 4, 1)}
        isProcessing={false}
        onRegister={vi.fn()}
      />
    );
    expect(screen.getByRole('button', { name: /Podrobnosti termínu/ })).toHaveAccessibleName(
      /2\. opravný/
    );
  });
});
