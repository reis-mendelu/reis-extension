import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { AttemptBadgeLegend } from '../AttemptBadgeLegend';
import { OpenCard } from '../OpenCard';
import { RegisteredCard } from '../RegisteredCard';
import { useAppStore } from '../../../../../store/useAppStore';
import type { ExamTerm } from '../../../../../types/exams';
import type { OpenExam, RegisteredExam } from '../../../../../utils/mobile/examRows';

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
const term = (id: string, attemptTypes?: ExamTerm['attemptTypes']): ExamTerm => ({
  id,
  date: '09.11.2026',
  time: '11:00',
  attemptTypes,
});

const legend = () => screen.getByRole('list', { name: 'Typy termínů' });

/**
 * The badges on a term row are a circle with "Ř" or a digit. What they mean
 * lived only in `title`/`aria-label`, which a thumb never reveals — so each
 * subject's term list says it once, underneath.
 */
describe('AttemptBadgeLegend', () => {
  beforeEach(() => useAppStore.setState({ language: 'cz', now: NOW } as never));
  afterEach(cleanup);

  it('names only the types the terms carry, in attempt order', () => {
    render(<AttemptBadgeLegend terms={[term('1', ['retake2']), term('2', ['regular'])]} />);
    const items = within(legend()).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['ŘŘádný', '22. opravný']);
  });

  it('renders nothing when no term has a type', () => {
    const { container } = render(<AttemptBadgeLegend terms={[term('1'), term('2', [])]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('hides its badges from a screen reader, which would read each name twice', () => {
    render(<AttemptBadgeLegend terms={[term('1', ['retake1'])]} />);
    expect(within(legend()).queryByRole('img')).toBeNull();
  });

  it('sits under an open subject’s terms', () => {
    const section = {
      id: 's1',
      name: 'zkouška',
      type: 'exam',
      status: 'open',
      terms: [term('1', ['regular']), term('2', ['retake1'])],
    };
    const row = {
      section,
      subjectName: 'Matematika',
      sectionName: 'zkouška',
    } as unknown as OpenExam;
    render(
      <OpenCard
        row={row}
        now={NOW}
        expanded
        onToggle={() => {}}
        isProcessing={false}
        onRegister={() => {}}
      />
    );
    expect(within(legend()).getAllByRole('listitem')).toHaveLength(2);
  });

  it('on a registered card explains only the other terms, the ones that show badges', () => {
    const mine = term('1', ['retake3']);
    const section = {
      id: 's1',
      name: 'zkouška',
      type: 'exam',
      status: 'registered',
      registeredTerm: mine,
      terms: [mine, term('2', ['regular'])],
    };
    const row = {
      section,
      term: mine,
      date: new Date(2026, 10, 9, 11, 0),
      subjectName: 'Matematika',
      sectionName: 'zkouška',
    } as unknown as RegisteredExam;
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
    const items = within(legend()).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual(['ŘŘádný']);
  });
});
