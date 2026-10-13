import { useState } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { menuForDay } from '../../../utils/menuForDay';
import { formatHeaderDate } from '../../../utils/mobile/formatHeaderDate';
import { MenuOutletPanel } from './MenuOutletPanel';
import { IskamBalanceRow } from './IskamBalanceRow';
import { useIskamStore } from '../../../mobile/iskam/iskamStore';

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
 * Content only — the fetch belongs to the store (`initializeStore` and the two
 * language handlers in store/useAppStore.ts). A sheet that fetched on mount
 * would have a loading state that can never be reached anyway, since it cannot
 * be opened unless `MenuCard` already had the data.
 */
export function MenuSheet({ dayIso, onClose }: MenuSheetProps) {
  const { t, language } = useTranslation();
  const menu = useAppStore((s) => s.menu);
  const outlets = menuForDay(menu, new Date(`${dayIso}T00:00:00`));
  // The canteen by NAME, not position, so a language switch that re-fetches the
  // menu cannot leave the pick pointing at a different canteen.
  const [outletName, setOutletName] = useState<string | null>(null);

  // The sheet outlives the data it was opened on: a language switch clears
  // `menu` and re-fetches (store/useAppStore.ts), which can empty the day while
  // the sheet is still open.
  const picked = outlets.findIndex((o) => o.outlet === outletName);
  const safe = picked >= 0 ? picked : 0;
  const current = outlets[safe];
  // The balance is never kept past the sheet: closing drops it, so the next
  // open shows "checking", not a number from minutes ago.
  const close = () => {
    useIskamStore.getState().reset();
    onClose();
  };
  return (
    <Sheet size="content" onClose={close}>
      <SheetHeader
        title={t('menu.title')}
        subtitle={formatHeaderDate(
          new Date(`${dayIso}T00:00:00`),
          language === 'cz' ? 'cs' : language
        )}
        onClose={close}
      />
      <IskamBalanceRow />
      {!current ? (
        <div className="flex flex-col items-center gap-2 px-4 pb-8 pt-2 text-center text-base-content/60">
          <UtensilsCrossed size={32} className="opacity-40" />
          <p>{t('menu.unavailable')}</p>
        </div>
      ) : (
        // Every canteen's list, stacked in one grid cell — see MenuOutletPanel:
        // the cell keeps the height of the longest one, so switching canteen
        // does not move the sheet's top edge.
        <div className="grid px-4 pb-6">
          {outlets.map((o, index) => (
            <MenuOutletPanel
              key={o.outlet}
              outlets={outlets}
              index={index}
              shown={index === safe}
              onPick={(i) => setOutletName(outlets[i]!.outlet)}
            />
          ))}
        </div>
      )}
    </Sheet>
  );
}
