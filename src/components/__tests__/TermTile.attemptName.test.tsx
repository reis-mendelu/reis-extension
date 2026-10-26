import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TermTile } from '../TermTile';
import { useAppStore } from '../../store/useAppStore';
import type { ExamTerm } from '../../types/exams';

vi.mock('../../hooks/data/useWatchdog', () => ({
  useWatchdog: () => ({
    armed: false,
    firing: false,
    feedback: null,
    errorMessage: null,
    toggle: vi.fn(),
  }),
}));

const NOW = new Date(2026, 8, 20, 12, 0);

const open: ExamTerm = {
  id: 't1',
  date: '05.10.2026',
  time: '09:00',
  registrationStart: '01.09.2026 08:00',
  registrationEnd: '01.10.2026 23:59',
  capacity: { occupied: 3, total: 20, raw: '3/20' },
  attemptTypes: ['regular', 'retake1'],
};

/**
 * The tile's explicit `aria-label` replaces its content as the accessible
 * name, so the attempt pills — whose names are only a `title` — said nothing.
 * The timeline drawer's "change term" list renders no legend either, so a
 * screen reader had no way to tell a retake term from a regular one.
 */
describe('TermTile names the attempts it counts as', () => {
  beforeEach(() => useAppStore.setState({ now: NOW, language: 'cz' } as never));
  afterEach(cleanup);

  it('includes every attempt type in the register button’s name', () => {
    render(<TermTile term={open} onSelect={vi.fn()} />);
    const tile = screen.getByRole('button', { name: /05\.10\.2026 09:00/ });
    expect(tile).toHaveAccessibleName(/Řádný/);
    expect(tile).toHaveAccessibleName(/1\. opravný/);
  });

  it('adds nothing when IS listed no attempt type', () => {
    render(<TermTile term={{ ...open, attemptTypes: [] }} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', { name: /05\.10\.2026 09:00$/ })).toBeInTheDocument();
  });
});
