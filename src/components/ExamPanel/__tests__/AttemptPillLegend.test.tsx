import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { AttemptPillLegend } from '../AttemptPillLegend';
import { AttemptPill } from '../AttemptPill';
import { ExamSectionCard } from '../ExamSectionCard';
import { useAppStore } from '../../../store/useAppStore';
import type { ExamSection, ExamSubject, ExamTerm } from '../../../types/exams';

vi.mock('../TermNoteBlock', () => ({ TermNoteBlock: () => null }));
vi.mock('../ExamClassmatesStrip', () => ({ ExamClassmatesStrip: () => null }));
vi.mock('../RegisteredTermDetails', () => ({ RegisteredTermDetails: () => null }));
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
const term = (id: string, attemptTypes?: ExamTerm['attemptTypes']): ExamTerm => ({
  id,
  date: '12.01.2027',
  time: '09:00',
  canRegisterNow: true,
  attemptTypes,
});

const legend = () => screen.getByRole('list', { name: 'Typy termínů' });
const names = () =>
  within(legend())
    .getAllByRole('listitem')
    .map((li) => li.textContent);

/**
 * The extension's term tiles mark each attempt with a pill — a check for the
 * regular term, a turn-back arrow and a digit for a retake — whose meaning was
 * a hover tooltip. The expanded term list now spells it out once.
 */
describe('AttemptPillLegend', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', now: NOW } as never));
  afterEach(cleanup);

  it('names only the types the terms carry, in attempt order', () => {
    render(
      <AttemptPillLegend terms={[term('1', ['retake3', 'retake1']), term('2', ['regular'])]} />
    );
    expect(names()).toEqual(['Řádný', '11. opravný', '33. opravný']);
  });

  it('renders nothing when no term has a type', () => {
    const { container } = render(<AttemptPillLegend terms={[term('1')]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides its pills from a screen reader, which would read each name twice', () => {
    render(<AttemptPillLegend terms={[term('1', ['retake2'])]} />);
    expect(within(legend()).queryByTitle('2. opravný')).toBeNull();
    expect(
      within(legend()).getByText('2', { selector: 'span' }).closest('[aria-hidden]')
    ).not.toBeNull();
  });

  it('inks the pill with the tone token, which holds contrast on its tint in both themes', () => {
    const { container } = render(<AttemptPill type="retake1" />);
    expect(container.innerHTML).toContain('text-[var(--tone-warning)]');
    expect(container.innerHTML).not.toMatch(/\btext-warning\b/);
  });

  it('sits under an expanded card, explaining the alternatives and not the student’s own term', () => {
    const mine = term('100', ['retake3']);
    const section: ExamSection = {
      id: 's1',
      name: 'zkouška',
      type: 'exam',
      status: 'registered',
      registeredTerm: { id: '100', date: mine.date, time: mine.time },
      terms: [mine, term('200', ['regular'])],
    };
    const subject: ExamSubject = {
      version: 1,
      id: 'E',
      name: 'Ekonomie',
      code: 'E',
      sections: [section],
    };
    render(
      <ExamSectionCard
        subject={subject}
        section={section}
        isExpanded
        isProcessing={false}
        onToggleExpand={vi.fn()}
        onRegister={vi.fn()}
        onUnregister={vi.fn()}
      />
    );
    expect(names()).toEqual(['Řádný']);
  });

  it('is absent while the card is collapsed', () => {
    const section: ExamSection = {
      id: 's1',
      name: 'zkouška',
      type: 'exam',
      status: 'open',
      terms: [term('200', ['regular'])],
    };
    const subject: ExamSubject = {
      version: 1,
      id: 'E',
      name: 'Ekonomie',
      code: 'E',
      sections: [section],
    };
    render(
      <ExamSectionCard
        subject={subject}
        section={section}
        isExpanded={false}
        isProcessing={false}
        onToggleExpand={vi.fn()}
        onRegister={vi.fn()}
        onUnregister={vi.fn()}
      />
    );
    expect(screen.queryByRole('list', { name: 'Typy termínů' })).toBeNull();
  });
});
