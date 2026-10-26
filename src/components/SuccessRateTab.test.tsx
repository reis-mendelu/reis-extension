import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SuccessRateTab } from './SuccessRateTab';
import { useAppStore } from '../store/useAppStore';
import type { SubjectSuccessRate } from '../types/documents';

const rate = (courseCode: string, pass: number, fail: number): SubjectSuccessRate => ({
  courseCode,
  lastUpdated: '2026-09-22T12:17:27.977Z',
  stats: [
    {
      semesterName: 'ZS 2025/2026 - ZF',
      semesterId: '794',
      year: 2025,
      totalPass: pass,
      totalFail: fail,
      sourceUrl: 'https://is.mendelu.cz/x',
      type: 'credit',
      terms: [
        {
          term: 'Všechny termíny',
          grades: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, FN: 0 },
          pass,
          fail,
          creditGrades: { zap: pass, nezap: fail, zapNedost: 0 },
        },
      ],
    },
  ],
});
const EKO1R = {
  code: 'EKO1R',
  nameCs: 'Ekologie I (RSZ)',
  nameEn: 'Ecology I',
  reasons: ['sameName', 'sameGuarantor'],
  completion: 'credit' as const,
  completionChanged: true,
  lastYear: 2025,
};
const EK1 = { ...EKO1R, code: 'EK1', nameCs: 'Ekologie I', lastYear: 2020 };
const KLI = {
  code: 'KLI',
  nameCs: 'Klimatologie',
  nameEn: 'Climatology',
  reasons: ['sameGuarantor', 'someFutureReason'],
  completion: 'exam' as const,
  completionChanged: false,
  lastYear: 2020,
};

function seed(state: Record<string, unknown>) {
  useAppStore.setState({
    language: 'cz',
    successRates: {},
    successRatesLoading: {},
    similarSubjects: {},
    fetchSuccessRate: vi.fn(async () => {}),
    fetchSimilarSubjects: vi.fn(async () => {}),
    ...state,
  } as never);
}

describe('SuccessRateTab', () => {
  beforeEach(() => seed({}));

  it("shows the subject's own stats when it has them", () => {
    seed({ successRates: { TVKA1: rate('TVKA1', 65, 2) } });
    render(<SuccessRateTab courseCode="TVKA1" />);
    expect(screen.getByText(/67 studentů/)).toBeTruthy();
    expect(screen.queryByText('Podobné předměty')).toBeNull();
  });

  it('says there are no results yet, and offers nothing, without suggestions', () => {
    seed({ similarSubjects: { ZZZ1: [] } });
    render(<SuccessRateTab courseCode="ZZZ1" />);
    expect(screen.getByText('Zatím bez výsledků')).toBeTruthy();
    expect(screen.getByText('reIS pro tento předmět zatím nemá žádné výsledky.')).toBeTruthy();
    expect(screen.queryByText('Podobné předměty')).toBeNull();
  });

  it('keeps loading, not "no results", while similar subjects are still being looked up', () => {
    // No entry yet means the lookup has not answered. Showing the empty state
    // then reads as final, and the suggestions pop in a second later.
    seed({});
    render(<SuccessRateTab courseCode="PRVS" />);
    expect(screen.queryByText('Zatím bez výsledků')).toBeNull();
    expect(document.querySelector('.loading-spinner')).toBeTruthy();
  });

  it('lists suggestions as rows: reasons in one phrase, the fail rate, a stale year', () => {
    seed({
      similarSubjects: { EKOE1: [EKO1R, KLI] },
      successRates: { EKO1R: rate('EKO1R', 88, 12) },
    });
    render(<SuccessRateTab courseCode="EKOE1" />);
    expect(screen.getByText('Podobné předměty')).toBeTruthy();
    expect(screen.getByText('EKO1R, stejný název a garant')).toBeTruthy();
    expect(screen.getByText('KLI, stejný garant, naposledy 2020/21')).toBeTruthy();
    expect(screen.getByText('12%')).toBeTruthy();
    // Only one of the two changed type, so the note sits on that row.
    expect(screen.getByText('dříve zápočet, nyní zkouška')).toBeTruthy();
    expect(screen.queryByText(/Všechny:/)).toBeNull();
    expect(screen.queryByText(/someFutureReason/)).toBeNull();
  });

  it('says a completion change once when every suggestion shares it', () => {
    seed({ similarSubjects: { EKOE1: [EKO1R, EK1] } });
    render(<SuccessRateTab courseCode="EKOE1" />);
    expect(screen.getByText('Všechny: dříve zápočet, nyní zkouška')).toBeTruthy();
    expect(screen.queryByText('dříve zápočet, nyní zkouška')).toBeNull();
  });

  it('previews a suggestion under a line naming it, without giving the new subject its numbers', () => {
    seed({
      similarSubjects: { EKOE1: [EKO1R] },
      successRates: { EKO1R: rate('EKO1R', 65, 2) },
    });
    render(<SuccessRateTab courseCode="EKOE1" />);
    fireEvent.click(screen.getByRole('button', { name: /Ekologie I \(RSZ\)/ }));
    const line = screen.getByRole('status').textContent ?? '';
    expect(line).toContain('Výsledky jiného předmětu');
    expect(line).toContain('EKO1R');
    expect(line).toContain('dříve zápočet, nyní zkouška');
    expect(screen.getByText(/67 studentů/)).toBeTruthy();
    expect(useAppStore.getState().successRates.EKOE1).toBeUndefined();

    fireEvent.click(screen.getByRole('button', { name: 'Zpět' }));
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Podobné předměty')).toBeTruthy();
  });

  it('does not carry a preview over to another subject that offers the same one', () => {
    // The desktop drawer reuses the tab when the student switches subject.
    // ZABAH and ZABIHY both offer KLI; the second must open on its list.
    seed({
      similarSubjects: { ZABAH: [KLI], ZABIHY: [KLI] },
      successRates: { KLI: rate('KLI', 40, 5) },
    });
    const { rerender } = render(<SuccessRateTab courseCode="ZABAH" />);
    fireEvent.click(screen.getByRole('button', { name: /Klimatologie/ }));
    expect(screen.getByRole('status')).toBeTruthy();

    rerender(<SuccessRateTab courseCode="ZABIHY" />);
    expect(screen.queryByRole('status')).toBeNull();
    expect(screen.getByText('Podobné předměty')).toBeTruthy();
  });
});
