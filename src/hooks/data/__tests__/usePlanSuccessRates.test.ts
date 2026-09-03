import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePlanSuccessRates } from '../usePlanSuccessRates';
import { useAppStore } from '../../../store/useAppStore';
import type { StudyPlan } from '../../../types/studyPlan';

const plan = (codes: string[]) =>
  ({
    blocks: [
      {
        title: '3. semestr',
        groups: [
          {
            name: 'Povinné',
            statusDescription: '',
            subjects: codes.map((code, i) => ({
              id: String(i),
              code,
              name: code,
              credits: 5,
              type: 'zk',
              isEnrolled: true,
              isFulfilled: false,
              enrollmentCount: 1,
              rawStatusText: '',
            })),
          },
        ],
      },
    ],
  }) as StudyPlan;

/**
 * On a real iPad the failure-rate chip showed on ONE of eight rows — the only
 * subject whose drawer had been opened, since that is what populated
 * `successRates`. One red chip among eight blank rows reads as "this subject is
 * dangerous and the others are fine", which is worse than showing none.
 */
describe('usePlanSuccessRates', () => {
  beforeEach(() => {
    useAppStore.setState({ successRates: {}, successRatesLoading: {} } as never);
  });

  it('asks for every subject in the plan, not just the opened one', () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ fetchSuccessRateBatch: spy } as never);
    renderHook(() => usePlanSuccessRates(plan(['EBC-MATLAB', 'EBC-PSI', 'EBC-JAVA'])));
    expect(spy).toHaveBeenCalledWith(['EBC-MATLAB', 'EBC-PSI', 'EBC-JAVA']);
  });

  it('asks for nothing when there is no plan', () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ fetchSuccessRateBatch: spy } as never);
    renderHook(() => usePlanSuccessRates(null));
    expect(spy).not.toHaveBeenCalled();
  });

  it('asks for nothing when the plan carries no subjects', () => {
    const spy = vi.fn().mockResolvedValue(undefined);
    useAppStore.setState({ fetchSuccessRateBatch: spy } as never);
    renderHook(() => usePlanSuccessRates(plan([])));
    expect(spy).not.toHaveBeenCalled();
  });
});
