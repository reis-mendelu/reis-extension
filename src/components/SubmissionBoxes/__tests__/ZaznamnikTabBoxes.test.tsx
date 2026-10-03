import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { ZaznamnikTab } from '../../SubjectFileDrawer/ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * The subject's submission boxes, in the Záznamník tab both trees render —
 * the only place a box could be found again once the 48-hour alert was gone.
 */
describe('ZaznamnikTab — odevzdávárny', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: { data: { 'EBC-PJ': { hasPrubezne: true, hasTest: false, subjectId: 'P1' } } },
      odevzdavarny: [
        box({ name: 'Rozpracovaný projekt', deadline: '08.10.2026 23:59', odevzdavarnaId: '1' }),
        box({
          name: 'Zadání projektu',
          deadline: '15.10.2026 12:00',
          fileCount: 1,
          section: 'submitted',
          odevzdavarnaId: '2',
        }),
        box({
          name: '2. projekt',
          deadline: '26.04.2026 23:59',
          fileCount: 2,
          points: '90',
          section: 'submitted',
          isOpen: false,
          odevzdavarnaId: '3',
        }),
        box({
          name: 'Úloha 1',
          deadline: '22.02.2026 21:00',
          section: 'closed',
          isOpen: false,
          odevzdavarnaId: '',
        }),
        box({ name: 'Jiný předmět', courseId: 'P2', odevzdavarnaId: '5' }),
      ],
    } as never);
  });
  afterEach(cleanup);

  it('lists only this subject’s boxes, with the total in the heading', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    expect(screen.getByText('Odevzdávárny · 4')).toBeTruthy();
    expect(screen.queryByText('Jiný předmět')).toBeNull();
  });

  it('says plainly whether anything was uploaded, and links each open box to IS', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    const due = screen.getByTestId('submission-box-1');
    expect(within(due).getByText(/Nic neodevzdáno/)).toBeTruthy();
    expect(within(due).getByText('za 5 d')).toBeTruthy();
    expect(due.closest('a')?.getAttribute('href')).toContain('odevzdavarna=1');

    const handedIn = screen.getByTestId('submission-box-2');
    expect(within(handedIn).getByText(/Odevzdáno · 1 soubor$/)).toBeTruthy();
  });

  it('keeps closed boxes collapsed and neutral, with files and points', () => {
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    const closed = screen.getByTestId('submission-boxes-closed');
    expect(closed.hasAttribute('open')).toBe(false);
    expect(within(closed).getByText('Uzavřené · 2')).toBeTruthy();
    expect(within(closed).getByText(/2 soubory · 90 b\./)).toBeTruthy();
    // "nothing" — not "missed": most of these are exam dates the student never took.
    expect(within(closed).getByText(/nic$/)).toBeTruthy();
  });

  it('shows the boxes even when the subject has no assessment records yet', () => {
    useAppStore.setState({ zaznamnik: {} } as never);
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    expect(screen.getByText('Odevzdávárny · 4')).toBeTruthy();
  });

  it('renders no section for a subject without boxes', () => {
    useAppStore.setState({ odevzdavarny: [] });
    render(<ZaznamnikTab courseCode="EBC-PJ" />);
    expect(screen.queryByText(/^Odevzdávárny/)).toBeNull();
  });
});
