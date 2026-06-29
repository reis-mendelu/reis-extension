import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/**
 * ADVERSARIAL probing of the relocated Study Plan search wiring:
 *  - the local prefill ref path (onSearchSubject -> searchPrefillRef.current?.(name))
 *  - the onOpenSubject adapter: (code,name,id,faculty)=>onOpenSubject(code,name??code,id??'',faculty)
 */

const { captured, plan } = vi.hoisted(() => ({
  // Captures the props the page hands to <SearchBar> so tests can invoke them directly.
  captured: {
    onOpenSubject: null as null | ((code: string, name?: string, id?: string, faculty?: string) => void),
    register: true, // whether the mock registers a prefill fn into prefillRef
  },
  prefillSpy: vi.fn(),
  plan: {
    title: 'Test plan', isFulfilled: false, creditsAcquired: 0, creditsRequired: 180,
    blocks: [{
      title: 'Semester 1',
      groups: [{
        name: 'Required', statusDescription: '', subjects: [
          { id: '', code: 'EBC-ST', name: 'Statistika', credits: 5, type: 'P', isEnrolled: false, isFulfilled: false, enrollmentCount: 0, rawStatusText: '' },
        ],
      }],
    }],
  },
}));

const prefillSpy = vi.fn();

vi.mock('../../SearchBar/index', () => ({
  SearchBar: ({ prefillRef, onOpenSubject }: {
    prefillRef?: React.MutableRefObject<((q: string) => void) | null>;
    onOpenSubject?: (code: string, name?: string, id?: string, faculty?: string) => void;
  }) => {
    captured.onOpenSubject = onOpenSubject ?? null;
    React.useEffect(() => {
      if (prefillRef && captured.register) prefillRef.current = prefillSpy;
      return () => { if (prefillRef) prefillRef.current = null; };
    });
    return <div data-testid="study-plan-search" />;
  },
}));

// SemesterSection exposes the onSearchSubject it receives, parameterised so we can
// fire arbitrary (adversarial) query strings through the prefill path.
const { fireQuery } = vi.hoisted(() => ({ fireQuery: { value: 'Statistika' } }));
vi.mock('../SemesterSection', () => ({
  SemesterSection: ({ onSearchSubject }: { onSearchSubject: (n: string) => void }) => (
    <button onClick={() => onSearchSubject(fireQuery.value)}>mock-row-search</button>
  ),
}));

vi.mock('@/hooks/useStudyPlan', () => ({ useStudyPlan: () => plan }));
vi.mock('../useSubjectsData', () => ({ useSubjectsData: () => ({ zameraniLookup: new Map(), subjectSemesters: new Map(), subjectToZameranis: new Map(), zameraniProgress: new Map(), failRates: {}, enrolledCredits: 0 }) }));
vi.mock('../useOpenSemesters', () => ({ useOpenSemesters: () => ({ openSemesters: new Set(), currentSemesterRef: { current: null }, handleToggle: () => {} }) }));
vi.mock('../useZameraniPicks', () => ({ useZameraniPicks: () => ({ effectivePicks: [], togglePick: () => {} }) }));
vi.mock('../insights', () => ({ topHardestUpcoming: () => [], zameraniInsights: () => [] }));

import { StudyPlanPage } from '../StudyPlanPage';
import { useAppStore } from '@/store/useAppStore';

beforeEach(() => {
  useAppStore.setState({ language: 'en', successRates: {} });
  prefillSpy.mockClear();
  captured.onOpenSubject = null;
  captured.register = true;
  fireQuery.value = 'Statistika';
});

describe('StudyPlanPage prefill robustness (adversarial)', () => {
  const cases: Array<[string, string]> = [
    ['empty string', ''],
    ['whitespace only', '   '],
    ['single char', 'a'],
    ['regex meta', '.*+?[](){}|^$\\'],
    ['unicode/czech', 'Příklad ž č ř'],
    ['very long', 'x'.repeat(5000)],
    ['newlines/tabs', 'a\n\tb'],
  ];
  it.each(cases)('forwards %s verbatim into the prefill ref without throwing', async (_label, q) => {
    fireQuery.value = q;
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    await userEvent.click(screen.getByText('mock-row-search'));
    expect(prefillSpy).toHaveBeenCalledWith(q);
  });

  it('re-clicking fires the prefill each time', async () => {
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    const btn = screen.getByText('mock-row-search');
    await userEvent.click(btn);
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(prefillSpy).toHaveBeenCalledTimes(3);
  });

  it('no-ops safely (no throw) when SearchBar never registered a prefill fn', async () => {
    captured.register = false; // simulate ref never populated (e.g. clicked before SearchBar effect)
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={() => {}} />);
    await expect(userEvent.click(screen.getByText('mock-row-search'))).resolves.not.toThrow();
    expect(prefillSpy).not.toHaveBeenCalled();
  });
});

describe('StudyPlanPage onOpenSubject adapter (adversarial)', () => {
  it('falls back name->code and id->"" when SearchBar omits them', () => {
    const parent = vi.fn();
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={parent} />);
    expect(captured.onOpenSubject).toBeTypeOf('function');
    act(() => { captured.onOpenSubject!('EBC-ST', undefined, undefined, 'PEF'); });
    expect(parent).toHaveBeenCalledWith('EBC-ST', 'EBC-ST', '', 'PEF');
  });

  it('passes through a fully-populated subject selection', () => {
    const parent = vi.fn();
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={parent} />);
    act(() => { captured.onOpenSubject!('EBC-ST', 'Statistika', '12345', 'PEF'); });
    expect(parent).toHaveBeenCalledWith('EBC-ST', 'Statistika', '12345', 'PEF');
  });

  it('DEFECT PROBE: an empty subjectCode is forwarded as an empty courseCode (name fallback never triggers)', () => {
    const parent = vi.fn();
    render(<StudyPlanPage onBack={() => {}} onOpenSubject={parent} />);
    // SearchBar always passes result.title (a string) as name, so `name ?? code`
    // can never reach the code fallback. An empty name stays empty, not code.
    act(() => { captured.onOpenSubject!('', '', '', undefined); });
    expect(parent).toHaveBeenCalledWith('', '', '', undefined);
  });
});
