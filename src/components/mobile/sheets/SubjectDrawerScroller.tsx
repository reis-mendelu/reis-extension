import { useCallback, useRef, type ReactNode } from 'react';
import { useAppStore } from '../../../store/useAppStore';
import { AlwaysScrollable } from '../primitives/AlwaysScrollable';
import { PullRefreshIndicator } from '../primitives/PullRefreshIndicator';
import { useSwipeSteps } from '../primitives/useSwipeSteps';
import { swipeStartIsOffLimits } from '../primitives/swipeStartGuard';

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
 * A pull may START anywhere on the sheet but the PDF reader: on `top` (the
 * header, teachers and tab bar) as well as the list, the same fix the calendar
 * and exams got. The at-top gate is still the list's, so a pull from the
 * header does nothing once the list is scrolled down. The reader overlay is
 * the sheet's sibling of this, so a pull at the top of a PDF's pages never
 * turns into a files refresh.
 *
 * Files only. The other tabs have their own data and no refresh of their own
 * to hand it, so a pull there would spin for files the student is not looking
 * at. The empty and skeleton states are held pullable too (AlwaysScrollable):
 * "no files yet" is exactly when a student pulls to check.
 *
 * It also SWIPES, a tab at a time (`onSwipeStep`). The tab bar is at the top of
 * a full-height sheet, the furthest point from a thumb; the body is where the
 * thumb already is. Built exactly like the calendar's DayBody, which is the
 * same problem solved and verified on device: one element is both the pull
 * scroller and the swipe surface, `touch-pan-y` keeps the vertical pan native
 * and stops the WebView cancelling a sideways swipe partway, and the hook's
 * axis arbitration means a vertical drag is never claimed at all.
 *
 * A swipe may not START on a screen edge (the system back gesture), on a
 * horizontal scroller that overflows (the grading table, the semester chips)
 * or in a text field — see `swipeStartIsOffLimits`. Phone and iPad only:
 * src/test/guards/subjectTabSwipeIsPhoneOnly.test.ts.
 */
export function SubjectDrawerScroller({
  courseCode,
  pullable,
  top,
  onSwipeStep,
  children,
}: {
  courseCode: string;
  pullable: boolean;
  /** A sideways swipe across the body: -1 for the previous tab, +1 the next. */
  onSwipeStep: (steps: -1 | 1) => void;
  /** Everything above the list; part of where a pull may start. */
  top: ReactNode;
  children: ReactNode;
}) {
  const surfaceRef = useRef<HTMLDivElement>(null);
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

  /**
   * Written to the node, never through state, and damped to a third — both for
   * the reasons DayBody gives: a render per pointermove leaves the transition
   * easing the offset the finger sets, and the next tab is not laid out beside
   * this one, so following 1:1 would promise a carousel that is not there.
   */
  const setOffset = (px: number | null) => {
    const body = scrollerRef.current;
    if (!body) return;
    if (px === null) {
      body.style.removeProperty('transition');
      body.style.removeProperty('transform');
      return;
    }
    body.style.transition = 'none';
    body.style.transform = `translateX(${px / 3}px)`;
  };
  const { handlers } = useSwipeSteps({
    elementRef: scrollerRef,
    onMove: setOffset,
    onEnd: (steps) => {
      setOffset(null);
      if (steps !== 0) onSwipeStep(steps);
    },
    onCancel: () => setOffset(null),
    ignoreStart: (e) =>
      swipeStartIsOffLimits(e.target as Element, scrollerRef.current, e.clientX, window.innerWidth),
  });

  return (
    <div ref={surfaceRef} className="flex min-h-0 flex-1 flex-col">
      {top}
      <div className="relative flex min-h-0 flex-1 flex-col">
        {pullable && (
          <PullRefreshIndicator
            scrollerRef={scrollerRef}
            surfaceRef={surfaceRef}
            refreshing={refreshing}
            onRefresh={refresh}
          />
        )}
        <div
          ref={scrollerRef}
          data-testid="subject-drawer-scroller"
          {...handlers}
          // `[&_.overflow-y-auto]:touch-pan-y` reaches INTO the tab bodies.
          // Every tab but Soubory scrolls in its own `overflow-y-auto` box, and
          // a touch resolves touch-action only up to the nearest scroll
          // container — so this element's pan-y never reached a finger on
          // Spolužáci or Úspěšnost, and Chrome cancelled 6 of 120 driven swipes
          // there mid-gesture (0 of 120 with this). Set from here, not in the
          // tab components, because those are shared with the extension. A
          // horizontal scroller inside a tab is its own nearest container, so
          // the grading table still pans sideways.
          className="relative flex-1 touch-pan-y overflow-y-auto transition-transform duration-200 ease-out [&_.overflow-y-auto]:touch-pan-y"
        >
          {pullable ? <AlwaysScrollable>{children}</AlwaysScrollable> : children}
        </div>
      </div>
    </div>
  );
}
