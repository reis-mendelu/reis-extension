import { useIsHalloween } from '../../hooks/ui/useHalloween';
import { Bat, Spider } from './HalloweenArt';

/**
 * The desktop top bar's share of the Halloween week: three bats and a spider
 * dropping from the bar's top edge.
 *
 * An item in the bar's own row, not an overlay: it takes only space the row
 * has left over and shrinks away first, so it can never sit on the week
 * controls, the vývěska or the bell. Hidden below `lg`, where the row is full.
 */
export function HalloweenHeaderBats() {
  const on = useIsHalloween();
  if (!on) return null;

  return (
    <div
      data-testid="halloween-header"
      aria-hidden="true"
      className="pointer-events-none relative hidden h-10 w-64 min-w-0 flex-shrink lg:block text-base-content/80"
    >
      <Bat className="absolute left-2 top-1 h-5 w-10 -rotate-12" />
      <Bat className="absolute left-[38%] top-5 h-4 w-8 rotate-6" />
      <Bat className="absolute left-[62%] top-0 h-3 w-6 -rotate-3" />
      {/* Hangs from the bar's top edge, above the row's padding. */}
      <Spider thread={22} className="absolute -top-5 right-2" />
    </div>
  );
}
