import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ZaznamnikEmpty } from '../Zaznamnik/ZaznamnikEmpty';
import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';
import cs from '../../../i18n/locales/cs.json';
import en from '../../../i18n/locales/en.json';

/**
 * Záznamník's empty states are a glyph and a word or two, not a sentence
 * (Dominik, 2026-10-29): nobody read the sentence. The sentence stays as the
 * accessible name, so a screen reader still says exactly why it is empty.
 */
describe('ZaznamnikEmpty', () => {
  afterEach(cleanup);

  it.each(['noData', 'noAssessment', 'notLoaded', 'nothingYet'] as const)(
    '%s shows a short label and carries the sentence as its name',
    (reason) => {
      useAppStore.setState({ language: 'cz' } as never);
      render(<ZaznamnikEmpty reason={reason} />);
      const block = screen.getByRole('img', { name: cs.zaznamnik[reason] });
      expect(block).toHaveTextContent(cs.zaznamnik.emptyShort[reason]);
      expect(screen.queryByText(cs.zaznamnik[reason])).toBeNull();
      expect(cs.zaznamnik.emptyShort[reason].split(' ').length).toBeLessThanOrEqual(3);
    }
  );

  it('speaks English', () => {
    useAppStore.setState({ language: 'en' } as never);
    render(<ZaznamnikEmpty reason="noAssessment" />);
    const block = screen.getByRole('img', { name: en.zaznamnik.noAssessment });
    expect(block).toHaveTextContent(en.zaznamnik.emptyShort.noAssessment);
  });
});

describe('ZaznamnikTab empty state', () => {
  afterEach(cleanup);

  const seed = (attendance: Record<string, unknown>) =>
    useAppStore.setState({
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      zaznamnikLoading: {},
      zaznamnik: {},
      odevzdavarny: [],
      impersonation: null,
      attendance,
      subjects: { data: { EBC: { hasPrubezne: false, hasTest: false, subjectId: '789' } } },
    } as never);

  it('is the same block when it is the only thing in the tab', () => {
    seed({});
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getByRole('img', { name: cs.zaznamnik.noAssessment })).toBeInTheDocument();
    expect(screen.queryByText(cs.zaznamnik.noAssessment)).toBeNull();
  });

  it('sits under Docházka when attendance is shown', () => {
    seed({
      EBC: [
        {
          label: 'EBC Cv Út 13.00-14.50 Q05',
          records: [{ date: '20. 10. 2026', time: '13.00-14.50', room: 'Q05', status: 'absent' }],
        },
      ],
    });
    render(<ZaznamnikTab courseCode="EBC" />);
    const heading = screen.getByText(cs.zaznamnik.attendanceSection);
    const block = screen.getByRole('img', { name: cs.zaznamnik.noAssessment });
    expect(heading.compareDocumentPosition(block) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
