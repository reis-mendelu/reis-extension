import { useCallback, useRef, type ReactNode } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { AlwaysScrollable } from '../primitives/AlwaysScrollable';
import { PullRefreshIndicator } from '../primitives/PullRefreshIndicator';

/**
 * The subject sheet's tab body scroller, pullable on the Files tab: pull it
 * down to look for new uploads in this subject's IS folder, and only that.
 *
 * The refresh is `refreshFilesForSubject`, the same action the extension's
 * refresh button in the drawer header calls, so the two products agree on
 * what a refresh keeps: the list on screen stays while it runs, new uploads
 * are added when it lands, and a subfolder that failed to load keeps its files
 * (`mergeFolderListing`). Guarded here because the hook leaves a double
 * refresh to its owner, and a sheet opened on stale files is already
 * refreshing when the finger arrives.
 *
 * Files only. The other tabs have their own data and no refresh of their own
 * to hand it, so a pull there would spin for files the student is not looking
 * at. The empty and skeleton states are held pullable too (AlwaysScrollable):
 * "no files yet" is exactly when a student pulls to check.
 */
export function SubjectDrawerScroller({
  courseCode,
  pullable,
  children,
}: {
  courseCode: string;
  pullable: boolean;
  children: ReactNode;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Spins only over a list. With none on screen the tab shows its skeleton and
  // "Načítání souborů…" bar (DrawerTabBody's own isEmpty test), which already
  // say it; a spinner on top said it twice and held the skeleton down too.
  const refreshing = useAppStore(
    (s) => !!s.filesLoading[courseCode] && (s.files[courseCode]?.length ?? 0) > 0
  );
  const refresh = useCallback(() => {
    const state = useAppStore.getState();
    if (!state.filesLoading[courseCode]) void state.refreshFilesForSubject(courseCode);
  }, [courseCode]);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {pullable && (
        <PullRefreshIndicator
          scrollerRef={scrollerRef}
          refreshing={refreshing}
          onRefresh={refresh}
        />
      )}
      <div
        ref={scrollerRef}
        data-testid="subject-drawer-scroller"
        className="relative flex-1 overflow-y-auto"
      >
        {pullable ? <AlwaysScrollable>{children}</AlwaysScrollable> : children}
      </div>
    </div>
  );
}
