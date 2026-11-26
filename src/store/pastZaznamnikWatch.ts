import type { AppState } from './types';

interface Store {
  subscribe: (listener: (state: AppState, prev: AppState) => void) => () => void;
  getState: () => AppState;
}

/**
 * Starts the past-semester points that were asked for before the store could
 * answer. Event-driven, not an effect: it runs when one of the inputs of
 * pastZaznamnikVerdict changes (hydration, the ids, the subject list) and only
 * while a request is pending. loadPastZaznamnik re-judges each one: it fetches,
 * drops it, or leaves it pending. It never touches those inputs itself, so it
 * cannot re-trigger itself.
 */
export function watchPendingPastZaznamnik(store: Store): () => void {
  return store.subscribe((s, prev) => {
    const codes = Object.keys(s.pendingPastZaznamnik);
    if (codes.length === 0) return;
    if (
      s.zaznamnikHydrated === prev.zaznamnikHydrated &&
      s.subjects === prev.subjects &&
      s.studiumId === prev.studiumId &&
      s.obdobiId === prev.obdobiId &&
      s.impersonation === prev.impersonation
    )
      return;
    for (const code of codes) void s.loadPastZaznamnik(code);
  });
}
