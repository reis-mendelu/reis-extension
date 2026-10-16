import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react';
import { ZaznamnikTab } from '../../SubjectFileDrawer/ZaznamnikTab';
import { SubmissionBoxesSummary } from '../SubmissionBoxesSummary';
import { useAppStore } from '../../../store/useAppStore';
import { NOW, box } from './boxFixtures';

/**
 * IS needs two steps: upload files, then confirm the submission. Until the
 * second, IS keeps the box under "Kam mohu odevzdávat" — only the confirmed
 * ones move to "s odevzdanými soubory". reIS used to call any box with files
 * "Odevzdáno", so a student who stopped after the upload was told they were done.
 */
describe('submission boxes — uploaded but not confirmed', () => {
  beforeEach(() => {
    useAppStore.setState({
      now: NOW,
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      subjects: { data: { 'EBC-PJ': { hasPrubezne: true, hasTest: false, subjectId: 'P1' } } },
      odevzdavarny: [
        box({
          name: 'Nepotvrzený',
          deadline: '05.10.2026 10:00',
          fileCount: 2,
          odevzdavarnaId: '1',
        }),
        box({
          name: 'Potvrzený',
          deadline: '06.10.2026 10:00',
          fileCount: 1,
          section: 'submitted',
          odevzdavarnaId: '2',
        }),
        box({ name: 'Prázdný', deadline: '07.10.2026 10:00', odevzdavarnaId: '3' }),
        box({
          name: 'Ze staré verze',
          deadline: '08.10.2026 10:00',
          fileCount: 1,
          section: undefined,
          odevzdavarnaId: '4',
        }),
      ],
    } as never);
  });
  afterEach(cleanup);

  describe('the subject’s Záznamník list (extension and phone drawer)', () => {
    it('reads as a to-do, never as "Odevzdáno"', () => {
      render(<ZaznamnikTab courseCode="EBC-PJ" />);
      const card = screen.getByTestId('submission-box-1');
      expect(within(card).getByText(/Nahráno, nepotvrzeno/)).toBeTruthy();
      expect(within(card).getByText(/2 soubory/)).toBeTruthy();
      expect(card.textContent).not.toContain('Odevzdáno');
      expect(within(card).getByText('Potvrdit v IS')).toBeTruthy();
      expect(card.getAttribute('href')).toContain('odevzdavarna=1');
    });

    it('keeps "Odevzdáno" for a box IS lists as submitted', () => {
      render(<ZaznamnikTab courseCode="EBC-PJ" />);
      const card = screen.getByTestId('submission-box-2');
      expect(within(card).getByText(/Odevzdáno · 1 soubor$/)).toBeTruthy();
      expect(card.textContent).not.toContain('nepotvrzeno');
    });

    it('leaves an empty box and a row cached with no section as they were', () => {
      render(<ZaznamnikTab courseCode="EBC-PJ" />);
      expect(
        within(screen.getByTestId('submission-box-3')).getByText(/Nic neodevzdáno/)
      ).toBeTruthy();
      expect(
        within(screen.getByTestId('submission-box-4')).getByText(/Odevzdáno · 1 soubor$/)
      ).toBeTruthy();
    });

    it('speaks English too', () => {
      useAppStore.setState({ language: 'en' } as never);
      render(<ZaznamnikTab courseCode="EBC-PJ" />);
      const card = screen.getByTestId('submission-box-1');
      expect(within(card).getByText(/Uploaded, not confirmed/)).toBeTruthy();
      expect(within(card).getByText('Confirm in IS')).toBeTruthy();
    });

    it('summary row speaks English too', () => {
      useAppStore.setState({ language: 'en' } as never);
      render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
      const row = screen
        .getAllByTestId('submission-due-row')
        .find((r) => r.textContent?.includes('Nepotvrzený'))!;
      expect(row.textContent).toContain('Not confirmed');
    });

    it('stresses an unconfirmed box near its deadline like an empty one', () => {
      render(<ZaznamnikTab courseCode="EBC-PJ" />);
      expect(screen.getByTestId('submission-box-1').className).toContain('border-warning');
      expect(screen.getByTestId('submission-box-2').className).not.toContain('border-warning');
    });
  });

  describe('the Subjects-screen summary (both trees)', () => {
    it('collapsed: lists the unconfirmed box as due, marked, and not the confirmed one', () => {
      render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
      const rows = screen.getAllByTestId('submission-due-row');
      const names = rows.map((r) => r.textContent ?? '');
      expect(names.some((t) => t.includes('Nepotvrzený'))).toBe(true);
      expect(names.some((t) => t.includes('Potvrzený'))).toBe(false);
      const unconfirmed = rows.find((r) => r.textContent?.includes('Nepotvrzený'))!;
      expect(unconfirmed.textContent).toContain('Nepotvrzeno');
      expect(unconfirmed.textContent).not.toContain('Odevzdáno');
    });

    it('expanded: marks unconfirmed and confirmed boxes differently', () => {
      render(<SubmissionBoxesSummary onOpen={vi.fn()} />);
      fireEvent.click(screen.getByTestId('submission-boxes-toggle'));
      const byName = (n: string) =>
        screen.getAllByTestId('submission-open-row').find((r) => r.textContent?.includes(n))!;
      expect(byName('Nepotvrzený').textContent).toContain('Nepotvrzeno');
      expect(byName('Nepotvrzený').textContent).not.toContain('Odevzdáno');
      expect(byName('Potvrzený').textContent).toContain('Odevzdáno');
      expect(byName('Potvrzený').textContent).not.toContain('Nepotvrzeno');
      expect(byName('Ze staré verze').textContent).toContain('Odevzdáno');
    });
  });
});
