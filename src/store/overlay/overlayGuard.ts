import type { StateCreator } from 'zustand';
import type { AppState } from '../types';

/**
 * The IS-derived domains an impersonation replaces (schedule, plan, subjects)
 * or blanks (the rest). While one is active, NO writer but the impersonation
 * slice may touch them — the real sync keeps writing IndexedDB underneath, and
 * exit re-reads it. Code-keyed stores (files, classmates, attendance,
 * syllabuses) are left alone: foreign codes are simply absent there, and their
 * network fetchers are gated in their own slices.
 */
export const OVERLAY_KEYS = [
  'schedule',
  'studyPlanDual',
  'subjects',
  'exams',
  'studyStats',
  'studyComparison',
  'gradeHistory',
  'cvicneTests',
  'odevzdavarny',
] as const satisfies readonly (keyof AppState)[];

const OVERLAY_WRITE = Symbol('overlayWrite');

/** Marks a partial as the impersonation slice's own write. */
export function overlayWrite<T extends object>(partial: T): T {
  return Object.assign({ [OVERLAY_WRITE]: true }, partial);
}

type Partialish = Record<string | symbol, unknown>;

/**
 * One choke point instead of a guard in every slice: every `set` and every
 * external `setState` passes through here, so a writer added later is covered
 * without anyone remembering to add a check.
 */
export function overlayGuard(
  config: StateCreator<AppState, [], [], AppState>
): StateCreator<AppState, [], [], AppState> {
  return (set, get, api) => {
    const guarded = ((partial: unknown, replace?: boolean) => {
      const next = (
        typeof partial === 'function' ? (partial as (s: AppState) => unknown)(get()) : partial
      ) as Partialish | null;
      if (!next || typeof next !== 'object') return set(next as never, replace as never);
      const marked = next[OVERLAY_WRITE] === true;
      const clean: Partialish = { ...next };
      delete clean[OVERLAY_WRITE];
      const active = (get() as { impersonation?: unknown }).impersonation != null;
      if (active && !marked) for (const k of OVERLAY_KEYS) delete clean[k];
      return set(clean as never, replace as never);
    }) as typeof set;
    api.setState = guarded;
    return config(guarded, get, api);
  };
}
