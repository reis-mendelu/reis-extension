import { describe, it, expect } from 'vitest';
import { create } from 'zustand';
import { overlayGuard, overlayWrite, OVERLAY_KEYS } from '../overlayGuard';

type S = {
  impersonation: object | null;
  schedule: { data: string[] };
  theme: string;
  setSchedule: (d: string[]) => void;
};

// A tiny store with the guard, so this does not boot the whole app.
const make = () =>
  create<S>()(
    overlayGuard(((set: (p: Partial<S>) => void) => ({
      impersonation: null,
      schedule: { data: ['real'] },
      theme: 'light',
      setSchedule: (d: string[]) => set({ schedule: { data: d } }),
    })) as never) as never
  );

describe('overlayGuard', () => {
  it('passes every write through while no impersonation is active', () => {
    const s = make();
    s.getState().setSchedule(['a']);
    expect(s.getState().schedule.data).toEqual(['a']);
  });

  it('drops protected keys while impersonating, but keeps the rest of the write', () => {
    const s = make();
    s.setState(overlayWrite({ impersonation: {}, schedule: { data: ['fin'] } }));
    s.setState({ schedule: { data: ['real sync'] }, theme: 'dark' });
    s.getState().setSchedule(['real again']);
    expect(s.getState().schedule.data).toEqual(['fin']);
    expect(s.getState().theme).toBe('dark');
  });

  it('lets an overlayWrite through and leaves no marker in state', () => {
    const s = make();
    s.setState(overlayWrite({ impersonation: {}, schedule: { data: ['fin'] } }));
    s.setState(overlayWrite({ schedule: { data: ['fin2'] } }));
    expect(s.getState().schedule.data).toEqual(['fin2']);
    expect(Object.getOwnPropertySymbols(s.getState())).toEqual([]);
  });

  it('function updaters are guarded too', () => {
    const s = make();
    s.setState(overlayWrite({ impersonation: {}, schedule: { data: ['fin'] } }));
    s.setState((st) => ({ schedule: { data: [...st.schedule.data, 'x'] } }));
    expect(s.getState().schedule.data).toEqual(['fin']);
  });

  it('protects every IS-derived domain the overlay replaces or blanks', () => {
    expect([...OVERLAY_KEYS].sort()).toEqual(
      [
        'cvicneTests',
        'exams',
        'gradeHistory',
        'odevzdavarny',
        'schedule',
        'studyComparison',
        'studyPlanDual',
        'studyStats',
        'subjects',
      ].sort()
    );
  });
});
