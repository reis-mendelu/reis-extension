import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react';
import { clampPageIndex, pageAtOffset } from './pdfPagePosition';

/** How long scrolling has to rest before the page counts as read. */
const SETTLE_MS = 250;
/** Where on screen "the page being read" is measured: a third of the way down. */
const READING_LINE = 1 / 3;
/** Anything the student does in the pane. Until then the restore holds the page. */
const USER_INPUT = ['wheel', 'touchstart', 'pointerdown', 'keydown'] as const;

interface Options {
  containerRef: RefObject<HTMLDivElement | null>;
  numPages: number;
  /** True once the fit-to-width zoom is in: before that every offset is wrong. */
  fitted: boolean;
  /** The pages' wrapper; its height changes as rows learn their real size. */
  contentRef: RefObject<HTMLDivElement | null>;
  initialPage?: number | null;
  onPageChange?: (page: number) => void;
}

/**
 * Reopens the viewer on `initialPage` and reports the page being read.
 *
 * Nothing is reported until the restore has happened. The pane mounts at the
 * top and the restore waits for the fit-to-width zoom, so a report from that
 * first frame would save page 0 over the very page being restored.
 *
 * Until the student touches the pane, the restored page is held in place: rows
 * above it are sized from page 1 until they render, and a deck whose cover is
 * taller than its slides would otherwise drift off the page as they do.
 */
export function usePdfPagePosition({
  containerRef,
  numPages,
  fitted,
  contentRef,
  initialPage,
  onPageChange,
}: Options) {
  const rows = useRef(new Map<number, HTMLElement>());
  const target = useRef<number | null>(null);
  const restored = useRef(false);
  const holding = useRef(false);
  const reported = useRef<number | null>(null);
  const pending = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onPageChangeRef = useRef(onPageChange);
  useLayoutEffect(() => {
    onPageChangeRef.current = onPageChange;
  });

  const trackRow = useCallback((el: HTMLElement | null, index: number) => {
    if (el) rows.current.set(index, el);
    else rows.current.delete(index);
  }, []);

  const rowTop = useCallback(
    (index: number) => {
      const area = containerRef.current;
      const row = rows.current.get(index);
      if (!area || !row) return null;
      return row.getBoundingClientRect().top - area.getBoundingClientRect().top + area.scrollTop;
    },
    [containerRef]
  );

  const scrollToTarget = useCallback(() => {
    const area = containerRef.current;
    const top = target.current === null ? null : rowTop(target.current);
    if (area && top !== null) area.scrollTop = top;
  }, [containerRef, rowTop]);

  // The restore, once the zoom is in.
  useLayoutEffect(() => {
    if (!fitted || numPages === 0 || restored.current) return;
    const page = clampPageIndex(initialPage, numPages);
    target.current = page;
    reported.current = page;
    if (page > 0) {
      scrollToTarget();
      holding.current = true;
    }
    restored.current = true;
  }, [fitted, numPages, initialPage, scrollToTarget]);

  // Rows above the page changed height (a canvas rendered, a placeholder took
  // its real size): put the page back where it was.
  useEffect(() => {
    const content = contentRef.current;
    if (!content || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => {
      if (holding.current) scrollToTarget();
    });
    ro.observe(content);
    return () => ro.disconnect();
  }, [contentRef, scrollToTarget, numPages]);

  useEffect(() => {
    const area = containerRef.current;
    if (!area) return;
    const report = (page: number) => {
      pending.current = null;
      if (page === reported.current) return;
      reported.current = page;
      onPageChangeRef.current?.(page);
    };
    const onScroll = () => {
      if (!restored.current) return;
      const tops: number[] = [];
      for (let i = 0; i < rows.current.size; i++) tops.push(rowTop(i) ?? Infinity);
      const page = pageAtOffset(tops, area.scrollTop + area.clientHeight * READING_LINE);
      pending.current = page;
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => report(page), SETTLE_MS);
    };
    const release = () => {
      holding.current = false;
    };
    area.addEventListener('scroll', onScroll, { passive: true });
    for (const type of USER_INPUT) area.addEventListener(type, release, { passive: true });
    return () => {
      area.removeEventListener('scroll', onScroll);
      for (const type of USER_INPUT) area.removeEventListener(type, release);
      if (timer.current) clearTimeout(timer.current);
      // Closed mid-scroll: the page they were on still counts.
      if (pending.current !== null) report(pending.current);
    };
  }, [containerRef, rowTop]);

  return { trackRow };
}
