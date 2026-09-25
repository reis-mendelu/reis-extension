import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ExamSectionCard } from '../ExamSectionCard';
import { alternativeTerms } from '../utils';
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

// The parser lists the term the student is on in `terms` as well — the phone's
// card needs it there. It is not an alternative to itself.
const mine: ExamTerm = { id: '100', date: '12.01.2027', time: '09:00', canRegisterNow: false };
const other: ExamTerm = { id: '200', date: '19.01.2027', time: '09:00', canRegisterNow: true };

const section: ExamSection = {
  id: 's1',
  name: 'zkouška',
  type: 'exam',
  status: 'registered',
  registeredTerm: { id: '100', date: '12.01.2027', time: '09:00' },
  terms: [mine, other],
};
const subject: ExamSubject = {
  version: 1,
  id: 'EBC',
  name: 'Ekonomie',
  code: 'EBC',
  sections: [section],
};

describe('alternativeTerms', () => {
  it('leaves out the term the student is registered on', () => {
    expect(alternativeTerms(section).map((t) => t.id)).toEqual(['200']);
  });

  it('is every term where the student is on none', () => {
    const open = { ...section, status: 'open' as const, registeredTerm: undefined };
    expect(alternativeTerms(open).map((t) => t.id)).toEqual(['100', '200']);
  });
});

describe('ExamSectionCard, registered and expanded', () => {
  beforeEach(() => useAppStore.setState({ now: NOW }));
  afterEach(cleanup);

  it('lists only the other terms under "Změnit termín"', () => {
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
    // TermTile renders the date in both its layouts, "19.01" twice, "12.01" never.
    expect(screen.getAllByText('19.01').length).toBeGreaterThan(0);
    expect(screen.queryByText('12.01')).toBeNull();
  });

  it('is not expandable when the student is on the only term', () => {
    const onToggleExpand = vi.fn();
    const only = { ...section, terms: [mine] };
    render(
      <ExamSectionCard
        subject={{ ...subject, sections: [only] }}
        section={only}
        isExpanded={false}
        isProcessing={false}
        onToggleExpand={onToggleExpand}
        onRegister={vi.fn()}
        onUnregister={vi.fn()}
      />
    );
    expect(screen.queryByText('Změnit termín')).toBeNull();
  });
});
