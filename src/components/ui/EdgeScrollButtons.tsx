import type { RefObject } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { useScrollEdges } from '../../hooks/ui/useScrollEdges';

/** Most of a strip-width per press: the last item seen stays in view as a landmark. */
const STEP = 0.8;

const BUTTON =
  'absolute top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-base-content/25 bg-base-300 text-base-content shadow-md';

/**
 * Back and forward buttons over the ends of a sideways strip, for a mouse.
 *
 * A plain mouse wheel scrolls only vertically, and in the iPad app on a Mac the
 * scrollbar is an overlay indicator a pointer cannot grab (`custom-scrollbar`
 * styling does not apply there), so a strip that overflows had no mouse way
 * across at all — the registered exams, the grading table, a záznamník table,
 * the extension's exam timeline. Shown only without a touch pointer, only
 * while the strip overflows, and only the way that is still open; touch
 * swipes the strip as before.
 *
 * Buttons, not a re-mapped wheel. That was tried: a MacBook's trackpad sends
 * the same pixel wheel events as a mouse, momentum and all, and no test tells
 * them apart reliably — so stealing the vertical wheel over a strip stopped a
 * trackpad user's page scroll dead under the pointer. Here the wheel is never
 * touched: a trackpad keeps scrolling the page vertically and the strip
 * sideways, natively.
 *
 * The parent positions it: render it as a sibling of the scroller inside a
 * `relative` box.
 */
export function EdgeScrollButtons({ scrollerRef }: { scrollerRef: RefObject<HTMLElement | null> }) {
  const { t } = useTranslation();
  const isTouch = useAppStore((s) => s.isTouch);
  const { back, forward } = useScrollEdges(scrollerRef, !isTouch);
  if (isTouch) return null;
  const step = (dir: 1 | -1) => {
    const el = scrollerRef.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * STEP, behavior: 'smooth' });
  };
  return (
    <>
      {back && (
        <button
          type="button"
          onClick={() => step(-1)}
          aria-label={t('common.scrollBack')}
          className={`${BUTTON} left-1`}
        >
          <ChevronLeft size={16} />
        </button>
      )}
      {forward && (
        <button
          type="button"
          onClick={() => step(1)}
          aria-label={t('common.scrollForward')}
          className={`${BUTTON} right-1`}
        >
          <ChevronRight size={16} />
        </button>
      )}
    </>
  );
}
