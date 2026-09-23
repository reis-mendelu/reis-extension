import { useRef, type ReactNode } from 'react';
import { useAppStore } from '../../../../store/useAppStore';
import { AlwaysScrollable } from '../../primitives/AlwaysScrollable';
import { PullRefreshIndicator } from '../../primitives/PullRefreshIndicator';

/**
 * The exams list, pullable: pull it down to refresh the exam terms, and only
 * those (`triggerExamsRefresh`, ~0.6s of IS work).
 *
 * The EMPTY state goes in here too, not only the list. "No exams" is what a
 * student sees for most of the year, and it is exactly when they pull to check
 * whether the slots have opened yet — an empty state that did not scroll could
 * not be pulled at all.
 *
 * The indicator is a sibling of the scroller, as on the calendar, so nothing
 * that moves the scroller can drag it along.
 */
export function ExamsPullArea({ className, children }: { className: string; children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const refreshing = useAppStore((s) => s.examsRefreshing);
  const refresh = useAppStore((s) => s.triggerExamsRefresh);
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      <PullRefreshIndicator scrollerRef={scrollerRef} refreshing={refreshing} onRefresh={refresh} />
      <div ref={scrollerRef} data-testid="exam-list" className="flex-1 overflow-y-auto">
        <AlwaysScrollable className={className}>{children}</AlwaysScrollable>
      </div>
    </div>
  );
}
