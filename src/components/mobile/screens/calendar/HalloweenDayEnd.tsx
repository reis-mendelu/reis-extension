import { useIsHalloween } from '../../../../hooks/ui/useHalloween';
import { Bat, Cobweb, Spider } from '../../../halloween/HalloweenArt';

/**
 * The phone's share of the Halloween week: bats, a spider and a cobweb at the
 * END of the day, after the lessons, the files and lunch.
 *
 * In the flow, not over the screen: an overlay landed the spider on a lesson
 * card in the mockups. Here the day's content is always above it, so on a full
 * day it simply scrolls below the last lesson and covers nothing.
 */
export function HalloweenDayEnd() {
  const on = useIsHalloween();
  if (!on) return null;

  return (
    <div
      data-testid="halloween-day-end"
      aria-hidden="true"
      className="pointer-events-none relative mt-2 h-44 text-base-content/80"
    >
      <Bat className="absolute left-[24%] top-8 h-5 w-10 -rotate-12" />
      <Bat className="absolute left-[44%] top-3 h-3 w-6 rotate-6" />
      <Bat className="absolute left-[36%] top-16 h-4 w-8 -rotate-3" />
      <Spider thread={70} className="absolute right-10 top-0" />
      {/* Top corner, not bottom: the bottom of this block sits under the
          floating tab bar until the day is scrolled to its end. */}
      <Cobweb className="absolute left-0 top-0 h-16 w-16 text-base-content/25" />
    </div>
  );
}
