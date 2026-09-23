import { fireEvent } from '@testing-library/react';
import { useAppStore } from '../../../../store/useAppStore';
import { PULL_REFRESH_THRESHOLD_PX } from '../../primitives/pullToRefresh';

/** Shared by the pull-hint and refresh-hold suites: a loaded, empty app state. */
export const LOADED = {
  isSyncing: false,
  lastSync: 1,
  error: null,
  handshakeDone: true,
  handshakeTimedOut: false,
};

export function baseState(overrides: Record<string, unknown> = {}) {
  useAppStore.setState({
    language: 'cz',
    mobileSelectedDayIso: '2026-04-20',
    mobileSheets: [],
    firstSyncSettled: true,
    syncLoaded: { schedule: true, exams: true },
    schedule: { data: [], status: 'success' },
    exams: { data: [], status: 'success', error: null },
    syncStatus: LOADED,
    scheduleRefreshing: false,
    examsRefreshing: false,
    pullHintSeen: false,
    ...overrides,
  } as never);
}

export function pull(el: HTMLElement) {
  const at = (dy: number) => [{ clientX: 100, clientY: 100 + dy }];
  fireEvent.touchStart(el, { touches: at(0) });
  for (const f of [0.25, 0.5, 0.75, 1])
    fireEvent.touchMove(el, { touches: at((PULL_REFRESH_THRESHOLD_PX + 20) * f) });
  fireEvent.touchEnd(el, { touches: [] });
}
