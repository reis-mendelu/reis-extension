import { useRef, type ReactNode } from 'react';
import { EdgeScrollButtons } from './EdgeScrollButtons';

/**
 * A sideways scroller with the mouse's way across built in: the edge buttons
 * (EdgeScrollButtons) while it overflows and there is no touch pointer. For a
 * scroller rendered in a loop or anywhere a ref of its own is awkward; the
 * classes go on the scrolling box, as before.
 */
export function HorizontalScroller({
  className,
  children,
}: {
  className: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative">
      <div ref={ref} className={className}>
        {children}
      </div>
      <EdgeScrollButtons scrollerRef={ref} />
    </div>
  );
}
