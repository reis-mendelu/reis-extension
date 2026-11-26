import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';

/**
 * The IS links on this tab are for the day reIS lacks something or IS is the
 * only place that shows it. They were switched off on the phone while its sheet
 * pinned a footer link (#341 dropped the footer), so the phone lost them: both
 * trees show the same pair, and the tab has no opt-out any more.
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

  it('links průběžné and the test results in IS', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    const links = screen.getAllByRole('link');
    expect(links.map((a) => a.getAttribute('href'))).toEqual([
      expect.stringContaining('predmet=789;prubezne=1'),
      expect.stringContaining('predmet=789;test=1'),
    ]);
  });

  it('wraps, so two labels never push past a 320px phone', () => {
    const { container } = render(<ZaznamnikTab courseCode="EBC" />);
    expect(container.querySelector('a')?.parentElement?.className).toContain('flex-wrap');
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
    // The empty state is a glyph; its sentence is the accessible name.
    expect(screen.getByRole('img', { name: 'Zatím nic zapsáno.' })).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Žádná data hodnocení.' })).toBeNull();
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
    expect(
      screen.queryByRole('img', { name: 'Tento předmět nemá průběžné hodnocení ani testy.' })
    ).toBeNull();
    expect(
      screen.getByRole('img', { name: 'Hodnocení k tomuto předmětu reIS nenačítá.' })
    ).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Chybí tu něco? Nahlásit' })).toBeNull();
  });
});
