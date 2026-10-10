import { Soup, Utensils } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';
import type { OutletDayMenu } from '../../../utils/menuForDay';

/**
 * One canteen on one day: the canteen tabs for that day, then its dishes.
 *
 * MenuSheet stacks one of these per day×canteen in a single grid cell and shows
 * only the picked one. The hidden ones keep their height in the layout, which
 * is the point: the sheet hugs its content, and with only the picked list in
 * it the top edge jumped by up to 130px at 390px on every tab ("clicking
 * different days weirdly expands the drawer's height"). `invisible` takes the
 * hidden ones off screen and out of hit-testing, and `aria-hidden` out of the
 * accessibility tree, so each tab and dish exists once for anyone using it.
 */
export function MenuOutletPanel({
  outlets,
  index,
  shown,
  onPick,
}: {
  outlets: OutletDayMenu[];
  index: number;
  shown: boolean;
  onPick: (index: number) => void;
}) {
  const { t } = useTranslation();
  const current = outlets[index]!;
  return (
    <div
      data-testid="menu-dishes"
      aria-hidden={shown ? undefined : true}
      className={`col-start-1 row-start-1 flex flex-col ${shown ? '' : 'invisible'}`}
    >
      {/* One outlet is not a choice, so it gets no tab strip — the header
          already says which day, and the row below says which dishes. */}
      {outlets.length > 1 && (
        // A named group of pressed buttons, like the day row above it: a
        // tablist would promise tab panels and arrow keys (review on #530).
        <div role="group" aria-label={t('menu.outlet')} className="mb-3 flex gap-2">
          {outlets.map((o, i) => (
            <button
              key={o.outlet}
              type="button"
              aria-pressed={i === index}
              tabIndex={shown ? undefined : -1}
              onClick={() => onPick(i)}
              className={`min-h-9 flex-1 rounded-xl border px-3 text-sm font-bold ${
                i === index
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-base-300 text-base-content/60'
              }`}
            >
              {o.outlet}
            </button>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-2">
        {current.mainDishes.map((dish, i) => (
          <div
            key={`${dish}-${i}`}
            className="flex items-start gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5"
          >
            <Utensils size={16} className="mt-0.5 flex-shrink-0 text-base-content/40" />
            <span className="text-md text-base-content">{dish}</span>
          </div>
        ))}
        {/* Soup last. It is still served and a few people want it, but at
            MENDELU it is not what anyone opens this list for, and leading
            with it pushed the mains below the fold at 320px. */}
        {current.soup && (
          <div className="flex items-start gap-2.5 rounded-2xl border border-base-300 bg-base-100 px-3.5 py-2.5">
            <Soup size={16} className="mt-0.5 flex-shrink-0 text-primary" />
            <span className="text-md text-base-content">{current.soup}</span>
          </div>
        )}
      </div>
    </div>
  );
}
