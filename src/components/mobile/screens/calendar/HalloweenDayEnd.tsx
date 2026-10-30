import { useIsHalloween } from '../../../../hooks/ui/useHalloween';
import { Bat, Pumpkin, SprawlingWeb, Spider } from '../../../halloween/HalloweenArt';

/**
 * The phone's share of the Halloween week in Den: a cobweb, bats, a spider and
 * pumpkins at the END of the day, after the lessons, the files and lunch.
 *
 * In the flow, not over the screen: an overlay landed the spider on a lesson
 * card in the mockups. Here the day's content is always above it, so on a full
 * day it simply scrolls below the last lesson and covers nothing.
 *
 * The web hangs from the screen's left edge and spreads (spec 2026-10-30): a
 * small corner web floating mid-screen read as "just a block". The pumpkins
 * are here, not beside the date, where one read as a button.
 */
export function HalloweenDayEnd() {
  const on = useIsHalloween();
  if (!on) return null;

  return (
    <div
      data-testid="halloween-day-end"
      aria-hidden="true"
      className="pointer-events-none relative mt-2 h-44 overflow-hidden text-base-content/80"
    >
      {/* Top corner, not bottom: the bottom of this block sits under the
          floating tab bar until the day is scrolled to its end. */}
      <SprawlingWeb className="absolute left-0 top-0 h-40 w-56 text-base-content/25" />
      <Bat className="absolute left-[46%] top-8 h-5 w-10 -rotate-12" />
      <Bat className="absolute left-[62%] top-3 h-3 w-6 rotate-6" />
      <Bat className="absolute left-[56%] top-16 h-4 w-8 -rotate-3" />
      <Spider thread={70} className="absolute right-10 top-0" />
      <Pumpkin className="absolute bottom-3 right-24 h-9 w-9" />
      <Pumpkin className="absolute bottom-3 right-14 h-6 w-6" />
    </div>
  );
}
