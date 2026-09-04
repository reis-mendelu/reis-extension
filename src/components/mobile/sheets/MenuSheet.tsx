import { useState } from 'react';
import { UtensilsCrossed, Soup, Utensils } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { menuForDay } from '../../../utils/menuForDay';
import { formatHeaderDate } from '../../../utils/mobile/formatHeaderDate';

export interface MenuSheetProps {
  dayIso: string;
  onClose: () => void;
}

/**
 * The day's full jídelníček, one outlet at a time.
 *
 * Tabs rather than three stacked lists, the same choice the desktop popover
 * makes: a student eats at one menza, and scrolling past two they will not
 * visit to reach the one they will is the shape the popover already rejected.
 *
 * Content only — the fetch belongs to `MenuCard`, which is the thing that
 * decided there was a menu worth opening. A sheet that fetched on mount would
 * have a loading state that can never be reached, since it cannot be opened
 * unless the card already had the data.
 */
export function MenuSheet({ dayIso, onClose }: MenuSheetProps) {
  const { t, language } = useTranslation();
  const menu = useAppStore((s) => s.menu);
  const outlets = menuForDay(menu, new Date(`${dayIso}T00:00:00`));
  const [active, setActive] = useState(0);

  // The sheet outlives the card's own guard: the 5-minute language switch or a
  // refetch can empty the day while it is open.
  const safe = Math.min(active, Math.max(outlets.length - 1, 0));
  const current = outlets[safe];

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={t('menu.title')}
        subtitle={formatHeaderDate(new Date(`${dayIso}T00:00:00`), language === 'cz' ? 'cs' : language)}
        onClose={onClose}
      />
      {!current ? (
        <div className="flex flex-col items-center gap-2 px-4 pb-8 pt-2 text-center text-base-content/60">
          <UtensilsCrossed size={32} className="opacity-40" />
          <p>{t('menu.unavailable')}</p>
        </div>
      ) : (
        <div className="flex flex-col px-4 pb-6">
          {/* One outlet is not a choice, so it gets no tab strip — the header
              already says which day, and the row below says which dishes. */}
          {outlets.length > 1 && (
            <div role="tablist" className="mb-3 flex gap-2">
              {outlets.map((o, i) => (
                <button
                  key={o.outlet}
                  role="tab"
                  aria-selected={i === safe}
                  onClick={() => setActive(i)}
                  className={`min-h-9 flex-1 rounded-xl border px-3 text-sm font-bold ${
                    i === safe
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
      )}
    </Sheet>
  );
}
