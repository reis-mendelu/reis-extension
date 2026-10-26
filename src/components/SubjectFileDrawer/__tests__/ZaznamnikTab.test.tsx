import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The phone renders this tab inside a sheet that already pins ONE IS link in its
 * footer. Every other tab honours `showIsBacklink` for exactly that reason;
 * záznamník rendered its own pair unconditionally, so the sheet showed a
 * duplicate link on this tab alone.
 */
describe('ZaznamnikTab IS backlinks', () => {
  beforeEach(() => {
    useAppStore.setState({
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: {
        data: { EBC: { hasPrubezne: true, hasTest: true, subjectId: '789' } },
      },
    } as never);
  });

  afterEach(cleanup);

  it('renders the IS backlinks by default, as the desktop drawer expects', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getAllByRole('link').length).toBe(2);
  });

  it('renders none when the host pins its own IS link', () => {
    render(<ZaznamnikTab courseCode="EBC" showIsBacklink={false} />);
    expect(screen.queryAllByRole('link')).toHaveLength(0);
  });
});

describe('ZaznamnikTab report link', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      reportOpen: false,
      reportPrefill: null,
    } as never);
  });
  afterEach(cleanup);

  it('offers to report when a subject with assessment has no records', () => {
    useAppStore.setState({
      subjects: { data: { EBC: { hasPrubezne: true, hasTest: true, subjectId: '789' } } },
    } as never);
    render(<ZaznamnikTab courseCode="EBC" />);
    fireEvent.click(screen.getByRole('button', { name: 'Chybí tu něco? Nahlásit' }));
    expect(useAppStore.getState().reportPrefill).toEqual({ title: 'Záznamník: chybí data' });
  });

  it('stays quiet for a subject that has no assessment at all', () => {
    useAppStore.setState({
      subjects: { data: { EBC: { hasPrubezne: false, hasTest: false, subjectId: '789' } } },
    } as never);
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
  });
});

/**
 * Úvod do ICT, and most subjects early in a semester: IS lists the teacher's
 * arches, every one of them "nemáte dosud", and no test is written yet. The tab
 * hid the arches and said "Žádná data hodnocení." — the same words a broken
 * parse produces — so a correct, empty záznamník read as a bug.
 */
describe('ZaznamnikTab with arches that are all still empty', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: { data: { EBC: { hasPrubezne: true, hasTest: true, subjectId: '789' } } },
      zaznamnik: {
        EBC: {
          ph: {
            sections: [
              {
                label: 'Archy ze cvičení - všichni studenti',
                arches: [
                  { name: 'Zápočet', empty: true, columns: [], values: [] },
                  { name: 'Duplicitní studia', empty: true, columns: [], values: [] },
                ],
              },
            ],
            fetchedAt: 1,
          },
          vt: { tests: [], fetchedAt: 1 },
        },
      },
    } as never);
  });
  afterEach(() => {
    cleanup();
    useAppStore.setState({ zaznamnik: {} } as never);
  });

  it('shows the arches IS lists instead of hiding them', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getByText('Zápočet')).toBeTruthy();
    expect(screen.getByText('Duplicitní studia')).toBeTruthy();
  });

  it('says nothing is recorded yet, not that data is missing', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getByText('Zatím nic zapsáno.')).toBeTruthy();
    expect(screen.queryByText('Žádná data hodnocení.')).toBeNull();
  });
});

/**
 * A subject from an earlier semester that reIS only knows from the document
 * server carries no flags at all, and nothing is fetched for it. Saying it "has
 * no continuous assessment or tests" is a claim reIS cannot stand behind —
 * Úvod do ICT had ten tests and an exam.
 */
describe('ZaznamnikTab for a subject reIS never checked', () => {
  beforeEach(() => {
    useAppStore.setState({
      language: 'cz',
      zaznamnikHydrated: true,
      subjects: { data: { EBC: { subjectId: '789' } } },
    } as never);
  });
  afterEach(cleanup);

  it('does not claim the subject has no assessment', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.queryByText('Tento předmět nemá průběžné hodnocení ani testy.')).toBeNull();
    expect(screen.getByText('Hodnocení k tomuto předmětu reIS nenačítá.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
  });
});
