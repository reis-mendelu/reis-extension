import { useCallback } from 'react';
import { useAppStore } from '../../../store/useAppStore';

/**
 * A subject's files refresh, shared by the two routes to it on the phone tree:
 * the pull on the Files tab (SubjectDrawerScroller) and the RefreshButton in
 * the sheet header, which is the visible route on a Mac, where no pull reaches.
 *
 * `refreshing` spins only over a list. With none on screen the tab shows its
 * skeleton and "Načítání souborů…" bar (DrawerTabBody's own isEmpty test),
 * which already say it; a spinner on top said it twice.
 *
 * `refresh` is guarded because a sheet opened on stale files is already
 * refreshing when the finger or the click arrives, and the store leaves a
 * double refresh to its caller.
 */
export function useSubjectFilesRefresh(courseCode: string) {
  const refreshing = useAppStore(
    (s) => !!s.filesLoading[courseCode] && (s.files[courseCode]?.length ?? 0) > 0
  );
  const loading = useAppStore((s) => !!s.filesLoading[courseCode]);
  const refresh = useCallback(() => {
    const state = useAppStore.getState();
    if (!state.filesLoading[courseCode]) void state.refreshFilesForSubject(courseCode);
  }, [courseCode]);
  return { refreshing, loading, refresh };
}
