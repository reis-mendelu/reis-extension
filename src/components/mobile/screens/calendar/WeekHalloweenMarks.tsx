import { Pumpkin, Spider } from '../../../halloween/HalloweenArt';
import type { WeekHalloweenSpots } from './weekHalloween';

/**
 * One Týden column's Halloween marks: the spider hanging from its top, a
 * pumpkin on its bottom line — only where `weekHalloweenSpots` found the
 * column free, so neither ever lands on a lesson.
 */
export function WeekHalloweenMarks({
  iso,
  spots,
  spiderThread,
}: {
  iso: string;
  spots: WeekHalloweenSpots;
  spiderThread: number;
}) {
  return (
    <>
      {spots.spiderDay === iso && (
        <span
          data-testid="week-halloween-spider"
          aria-hidden="true"
          className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 text-base-content/70"
        >
          <Spider thread={spiderThread} />
        </span>
      )}
      {spots.pumpkinDays.includes(iso) && (
        <span
          data-testid="week-halloween-pumpkin"
          aria-hidden="true"
          className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2"
        >
          <Pumpkin className="h-7 w-7 md:h-9 md:w-9" />
        </span>
      )}
    </>
  );
}
