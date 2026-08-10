import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { ErasmusPanel } from '../index';

/**
 * `fetchKontrolaData` pulls the student's date of birth, and the ONLY thing that
 * renders it is StudentInfoSection inside the Learning Agreement tab. The phone
 * hides that tab (`showLearningAgreement={false}`), so opening the mobile
 * Erasmus sheet was fetching a date of birth nothing could display.
 *
 * `getUserParams` is deliberately NOT gated the same way: the Explore tab's
 * faculty filter reads `userParams.facultyLabel`, so gating it would break the
 * one tab the phone does show.
 */
const fetchKontrolaData = vi.hoisted(() => vi.fn().mockResolvedValue(null));
const getUserParams = vi.hoisted(() => vi.fn().mockResolvedValue(null));

vi.mock('@/api/kontrola', () => ({ fetchKontrolaData }));
vi.mock('@/utils/userParams', () => ({ getUserParams }));
vi.mock('@/hooks/data/useErasmus', () => ({
  useErasmus: () => ({
    reports: [],
    countryFile: null,
    setCountry: vi.fn(),
    loading: false,
    config: null,
  }),
}));
vi.mock('@/hooks/useStudyPlan', () => ({ useStudyPlan: () => null }));
vi.mock('../EuropeMap', () => ({ EuropeMap: () => null }));
vi.mock('../ErasmusDrawer', () => ({ ErasmusDrawer: () => null }));
vi.mock('../StudentInfoSection', () => ({ StudentInfoSection: () => null }));
vi.mock('../LATableA', () => ({ LATableA: () => null }));
vi.mock('../ErasmusExportButton', () => ({ ErasmusExportButton: () => null }));

const noop = () => {};

describe('ErasmusPanel personal-data fetches', () => {
  beforeEach(() => {
    fetchKontrolaData.mockClear();
    getUserParams.mockClear();
  });

  afterEach(cleanup);

  it('does not read the date of birth when the Learning Agreement is hidden', () => {
    render(
      <ErasmusPanel onOpenSubject={noop} onSearchSubject={noop} showLearningAgreement={false} />
    );
    expect(fetchKontrolaData).not.toHaveBeenCalled();
  });

  it('still reads user params, which the Explore faculty filter needs', () => {
    render(
      <ErasmusPanel onOpenSubject={noop} onSearchSubject={noop} showLearningAgreement={false} />
    );
    expect(getUserParams).toHaveBeenCalled();
  });

  it('reads the date of birth when the Learning Agreement is shown', () => {
    render(<ErasmusPanel onOpenSubject={noop} onSearchSubject={noop} />);
    expect(fetchKontrolaData).toHaveBeenCalled();
  });
});
