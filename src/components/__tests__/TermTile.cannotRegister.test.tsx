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

const NOW = new Date(2026, 8, 20, 12, 0);

// Opens in 30 minutes: inside the sniper window, where the tile offers "Arm".
const blocked: ExamTerm = {
  id: 't1',
  date: '05.10.2026',
  time: '09:00',
  registrationStart: '20.09.2026 12:30',
  registrationEnd: '01.10.2026 23:59',
  canRegisterNow: false,
  cannotRegister: true,
  blockReasonUrl: 'https://is.mendelu.cz/auth/student/terminy_seznam.pl?zobraz_duvod=1',
};

const section: ExamSection = {
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'open',
  terms: [blocked],
};

/**
 * A term from "Kam se přihlásit nemohu?" keeps IS's registration dates, but
 * they never open for this student. The tile must not count down to them, and
 * above all must not offer to auto-register: arming it would hammer IS with
 * registrations it refuses.
 */
describe('TermTile on a term the student cannot register for', () => {
  beforeEach(() => useAppStore.setState({ now: NOW }));
  afterEach(cleanup);

  it('offers no countdown and no auto-registration', () => {
    render(<TermTile term={blocked} section={section} onSelect={vi.fn()} onToggleArm={vi.fn()} />);
    expect(screen.queryByText(/Zapnout auto-rezervaci/)).toBeNull();
    expect(screen.queryByText(/Otevírá se/)).toBeNull();
  });

  it('says it cannot be registered for, not that it is closed', () => {
    render(<TermTile term={blocked} section={section} onSelect={vi.fn()} onToggleArm={vi.fn()} />);
    expect(screen.getAllByText('NELZE SE PŘIHLÁSIT').length).toBeGreaterThan(0);
    expect(screen.queryByText('UZAVŘENO')).toBeNull();
  });

  it('is not selectable', () => {
    const onSelect = vi.fn();
    const { container } = render(<TermTile term={blocked} section={section} onSelect={onSelect} />);
    (container.firstElementChild as HTMLElement).click();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
