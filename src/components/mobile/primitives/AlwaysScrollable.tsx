import type { ReactNode } from 'react';

export interface AlwaysScrollableProps {
  /** The layout the scroller's content had — gap, padding, flex direction. */
  className?: string;
  children: ReactNode;
}

/**
 * The content box inside a tab's scroller, held one pixel taller than it.
 *
 * Every tab scrolls once its content overflows. On most phones it does not:
 * the Předměty card, a light exam week, an empty day all fit, and a list that
 * fits does not move under a drag — the tab felt frozen next to every other
 * list on the device ("u všech těch záložek by měla být možnost jezdit nahoru
 * a dolů"). One pixel of overflow is enough for iOS to rubber-band it, and is
 * not a visible gap.
 *
 * Goes directly inside the element that carries `overflow-y-auto`, which keeps
 * its own ref, gesture handlers and test id — only the layout moves in here.
 */
export function AlwaysScrollable({ className = '', children }: AlwaysScrollableProps) {
  return <div className={`flex min-h-[calc(100%+1px)] flex-col ${className}`}>{children}</div>;
}
