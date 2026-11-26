import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermTile } from '../TermTile';
import { useAppStore } from '../../store/useAppStore';
import type { ExamSection, ExamTerm } from '../../types/exams';

vi.mock('../../hooks/data/useWatchdog', () => ({
  useWatchdog: () => ({
    armed: false,
    firing: false,
    feedback: null,
    errorMessage: null,
    toggle: vi.fn(),
  }),
}));

const START = new Date(2026, 11, 1, 8, 0, 0);

const term: ExamTerm = {
  id: 't1',
  date: '15.12.2026',
  time: '09:00',
  registrationStart: '01.12.2026 08:00',
  registrationEnd: '14.12.2026 23:59',
  canRegisterNow: false,
  capacity: { occupied: 3, total: 40, raw: '3/40' },
};
const section: ExamSection = {
  id: 's',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [term],
};

/**
 * Right after the opening the tile used to say UZAVŘENO (no link yet from IS,
 * and no longer in the future) until the next sync. It must say neither that
 * nor offer Přihlásit — the clock never unlocks a term, only IS's link does.
 */
describe('TermTile the moment registration opens', () => {
  afterEach(cleanup);
  beforeEach(() =>
    useAppStore.setState({ language: 'cz', now: new Date(START.getTime() + 10_000) } as never)
  );

  it('is neutral: opening, not closed, not registrable', () => {
    render(<TermTile term={term} section={section} onSelect={vi.fn()} />);
    expect(screen.queryByText('UZAVŘENO')).toBeNull();
    expect(screen.queryByText(/Přihlásit/)).toBeNull();
    expect(screen.getAllByText(/Otevírá se/).length).toBeGreaterThan(0);
  });

  it('is not a button and does not select on click', () => {
    const onSelect = vi.fn();
    const { container } = render(<TermTile term={term} section={section} onSelect={onSelect} />);
    expect(screen.queryByRole('button')).toBeNull();
    (container.firstElementChild as HTMLElement).click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
