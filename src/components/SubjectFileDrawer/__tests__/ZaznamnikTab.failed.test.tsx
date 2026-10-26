import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { ZaznamnikTab } from '../ZaznamnikTab';
import { useAppStore } from '../../../store/useAppStore';
import cs from '../../../i18n/locales/cs.json';

/**
 * Návrhy #26, the Záznamník half. `fetchSubjectZaznamnik` returns null only
 * when it failed — a page that loaded is always an object, empty or not — and
 * `setZaznamnikBatch` never puts that null over real data. So null in the store
 * means "the last fetch failed and nothing better is known", and the tab used
 * to show it as "Žádná data hodnocení.", the words for a subject with no marks.
 * Do not normalise null to an empty záznamník: this test is what that breaks.
 */
describe('ZaznamnikTab when the fetch failed', () => {
  let refetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    refetch = vi.fn(async () => undefined);
    useAppStore.setState({
      // Reset here, not in a test body: a failed assertion would skip it, and
      // a leaked impersonation makes overlayGuard drop later tests' writes.
      impersonation: null,
      language: 'cz',
      studiumId: '123',
      obdobiId: '456',
      zaznamnikHydrated: true,
      zaznamnikLoading: {},
      subjects: { data: { EBC: { hasPrubezne: true, hasTest: false, subjectId: '789' } } },
      zaznamnik: { EBC: null },
      refetchZaznamnik: refetch,
    } as never);
  });
  afterEach(cleanup);

  it('says it could not load instead of "no assessment data"', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getByText(cs.mobile.loadFailed.title)).toBeInTheDocument();
    expect(screen.queryByText(cs.zaznamnik.noData)).toBeNull();
  });

  it('retries this subject', () => {
    render(<ZaznamnikTab courseCode="EBC" />);
    fireEvent.click(screen.getByRole('button', { name: cs.mobile.loadFailed.retry }));
    expect(refetch).toHaveBeenCalledWith('EBC');
  });

  it('shows the skeleton while the retry runs', () => {
    useAppStore.setState({ zaznamnikLoading: { EBC: true } } as never);
    const { container } = render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.queryByText(cs.mobile.loadFailed.title)).toBeNull();
    expect(container.querySelector('.animate-pulse')).not.toBeNull();
  });

  it('offers no retry button it cannot honour — while impersonating', () => {
    useAppStore.setState({ impersonation: { programme: 'x' } } as never);
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getByText(cs.mobile.loadFailed.title)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: cs.mobile.loadFailed.retry })).toBeNull();
  });

  it('keeps "no assessment data" for a subject never fetched (undefined)', () => {
    useAppStore.setState({ zaznamnik: {} } as never);
    render(<ZaznamnikTab courseCode="EBC" />);
    expect(screen.getByText(cs.zaznamnik.noData)).toBeInTheDocument();
    expect(screen.queryByText(cs.mobile.loadFailed.title)).toBeNull();
  });
});
