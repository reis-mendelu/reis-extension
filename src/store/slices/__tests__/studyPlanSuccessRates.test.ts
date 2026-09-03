import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAppStore } from '../../useAppStore';
import { IndexedDBService } from '../../../services/storage';

/**
 * The failure rates are fetched when the PLAN lands, not when a screen mounts.
 *
 * They used to be pulled by a `useEffect` in `usePlanSuccessRates`, which
 * SubjectsScreen called — so mounting a component started a fetch. That is the
 * thing the project's rules forbid outright ("NO `useEffect` for data
 * fetching — fetch in services/store, not components"), and it was flagged
 * twice in review on this PR.
 *
 * `fetchStudyPlan` is the only writer of `studyPlanDual` in the whole app,
 * which makes it the one honest trigger: the rates are wanted exactly when
 * there is a plan to want them for.
 */
const plan = (codes: string[]) => ({
  cz: {
    title: 'B-OI',
    creditsAcquired: 30,
    creditsRequired: 180,
    blocks: [{ groups: [{ subjects: codes.map((code) => ({ code, name: code })) }] }],
  },
  en: {
    title: 'B-OI',
    creditsAcquired: 30,
    creditsRequired: 180,
    blocks: [{ groups: [{ subjects: codes.map((code) => ({ code, name: code })) }] }],
  },
});

describe('fetchStudyPlan triggers the success-rate batch', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({ studyPlanDual: null, studyPlanLoaded: false } as never);
  });

  it('asks for every subject code in the plan once the plan is stored', async () => {
    vi.spyOn(IndexedDBService, 'get').mockResolvedValue(plan(['EBC-IV', 'EBC-MAT']) as never);
    const batch = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ fetchSuccessRateBatch: batch } as never);

    await useAppStore.getState().fetchStudyPlan();

    expect(useAppStore.getState().studyPlanDual).not.toBeNull();
    expect(batch).toHaveBeenCalledTimes(1);
    expect(batch.mock.calls[0]?.[0]).toEqual(['EBC-IV', 'EBC-MAT']);
  });

  it('asks for nothing when there is no plan to ask about', async () => {
    vi.spyOn(IndexedDBService, 'get').mockResolvedValue(null as never);
    const batch = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ fetchSuccessRateBatch: batch } as never);

    await useAppStore.getState().fetchStudyPlan();
    expect(batch).not.toHaveBeenCalled();
  });

  it('asks for nothing when the plan has no subjects', async () => {
    vi.spyOn(IndexedDBService, 'get').mockResolvedValue(plan([]) as never);
    const batch = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ fetchSuccessRateBatch: batch } as never);

    await useAppStore.getState().fetchStudyPlan();
    expect(batch).not.toHaveBeenCalled();
  });

  it('still stores the plan if the rate fetch rejects', async () => {
    // The rates are a decoration on the rows; the plan is the screen. A failed
    // batch must not cost the student their subject list.
    vi.spyOn(IndexedDBService, 'get').mockResolvedValue(plan(['EBC-IV']) as never);
    useAppStore.setState({
      fetchSuccessRateBatch: vi.fn().mockRejectedValue(new Error('CDN down')),
    } as never);

    await useAppStore.getState().fetchStudyPlan();
    expect(useAppStore.getState().studyPlanDual).not.toBeNull();
    expect(useAppStore.getState().studyPlanLoaded).toBe(true);
  });
});
