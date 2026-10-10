import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { menuForDay } from '../../../utils/menuForDay';
import { formatHeaderDate } from '../../../utils/mobile/formatHeaderDate';
import { formatWeekRange } from '../../../utils/mobile/formatWeekRange';
import { MenuDayTabs } from './MenuDayTabs';
import { MenuOutletPanel } from './MenuOutletPanel';

export interface MenuSheetProps {
  dayIso: string;
  /** The shown week, from Týden's chef hat: the sheet then picks among its days. */
  week?: string[];
  onClose: () => void;
}

/**
 * The day's full jídelníček, one outlet at a time.
 *
 * Tabs rather than three stacked lists, the same choice the desktop popover
 * makes: a student eats at one menza, and scrolling past two they will not
 * visit to reach the one they will is the shape the popover already rejected.
 *
 * Content only — the fetch belongs to the store (`initializeStore` and the two
 * language handlers in store/useAppStore.ts). A sheet that fetched on mount
 * would have a loading state that can never be reached anyway, since it cannot
 * be opened unless `MenuCard` already had the data.
 */
export function MenuSheet({ dayIso, week, onClose }: MenuSheetProps) {
  const { t, language } = useTranslation();
  const menu = useAppStore((s) => s.menu);
  const [day, setDay] = useState(dayIso);
  const outlets = menuForDay(menu, new Date(`${day}T00:00:00`));
  // The canteen by NAME, not position: days serve different canteens, so a
  // position picked on Monday can name another canteen on Wednesday.
  const [outletName, setOutletName] = useState<string | null>(null);

  // The sheet outlives the data it was opened on: a language switch clears
  // `menu` and re-fetches (store/useAppStore.ts), which can empty the day while
  // the sheet is still open.
  const picked = outlets.findIndex((o) => o.outlet === outletName);
  const safe = picked >= 0 ? picked : 0;
  const current = outlets[safe];
  const panels = (week?.length ? week : [day]).flatMap((d) => {
    const all = menuForDay(menu, new Date(`${d}T00:00:00`));
    return all.map((_, index) => ({ day: d, outlets: all, index }));
  });

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader
        title={t('menu.title')}
        subtitle={
          week?.length
            ? formatWeekRange(
                new Date(`${week[0]}T00:00:00`),
                new Date(`${week[week.length - 1]}T00:00:00`),
                language === 'en' ? 'en' : 'cz',
                'long'
              )
            : formatHeaderDate(new Date(`${day}T00:00:00`), language === 'cz' ? 'cs' : language)
        }
        onClose={onClose}
      />
      {/* The header names the week, so the row says which day. Picking one
          keeps the canteen if it serves that day too, else shows the first. */}
      {week?.length ? (
        <div className="px-4">
          <MenuDayTabs week={week} day={day} onPick={setDay} />
        </div>
      ) : null}
      {!current ? (
        <div className="flex flex-col items-center gap-2 px-4 pb-8 pt-2 text-center text-base-content/60">
          <UtensilsCrossed size={32} className="opacity-40" />
          <p>{t('menu.unavailable')}</p>
        </div>
      ) : (
        // Every day×canteen list of the open sheet, stacked in one grid cell —
        // see MenuOutletPanel: the cell keeps the height of the longest one, so
        // switching day or canteen no longer moves the sheet's top edge.
        <div className="grid px-4 pb-6">
          {panels.map((p) => (
            <MenuOutletPanel
              key={`${p.day}-${p.outlets[p.index]!.outlet}`}
              outlets={p.outlets}
              index={p.index}
              shown={p.day === day && p.index === safe}
              onPick={(i) => setOutletName(p.outlets[i]!.outlet)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
