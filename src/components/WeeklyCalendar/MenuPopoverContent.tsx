import { useState } from 'react';
import { Soup, Utensils, UtensilsCrossed } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useScreenSignal } from '../../hooks/useScreenSignal';
import { menuForDay } from '../../utils/menuForDay';
import { menuTabs } from '../../utils/menuTabs';
import { VenueMenuTab } from '../Jidelnicek/VenueMenuTab';

/**
 * The extension's jídelníček for one day, under a weekly-header chef hat: the
 * canteens (and S-klub for an FRRMS student) as tabs in reIS's order, then the
 * picked one. Mounted only while a popover is open, and keyed by the day in
 * WeeklyCalendarHeader, so another column's hat starts on the first tab.
 *
 * The tabs are a group of pressed buttons, as on the phone's sheet: a tablist
 * would promise arrow keys and linked panels it does not have (review on #530).
 */
export function MenuPopoverContent({
  dayIso,
  onClose,
}: {
  /** 'YYYY-MM-DD' of the column. */
  dayIso: string;
  onClose: () => void;
}) {
  useScreenSignal('screen_menu');
  const { t } = useTranslation();
  const menu = useAppStore((s) => s.menu);
  const menuLoading = useAppStore((s) => s.menuLoading);
  const menuError = useAppStore((s) => s.menuError);
  const faculty = useAppStore((s) => s.userFaculty);
  const venuePins = useAppStore((s) => s.venuePins);
  const focusSocietyPin = useAppStore((s) => s.focusSocietyPin);
  // By KEY, not position: S-klub and the faculty arrive asynchronously, and a
  // tab inserted before the picked one would otherwise take its place.
  const [picked, setPicked] = useState<string | null>(null);

  // No fetch here. The store asks for the menu at boot and again on a
  // language change (store/useAppStore.ts); the popover reads `menu`
  // synchronously and renders the loading and error states the store sets.
  if (menuLoading) {
    return (
      <div className="flex items-center justify-center py-6">
        <span className="loading loading-spinner loading-md text-primary" />
      </div>
    );
  }

  const tabs = menuError
    ? []
    : menuTabs(menuForDay(menu, new Date(`${dayIso}T00:00:00`)), {
        faculty,
        venuePins,
        dayIso,
      });

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-5 text-center">
        <UtensilsCrossed className="h-6 w-6 text-base-content/30" />
        <p className="text-xs text-base-content/70">{t('menu.unavailable')}</p>
      </div>
    );
  }

  const found = tabs.findIndex((t) => t.key === picked);
  const safeTab = found >= 0 ? found : 0;
  const current = tabs[safeTab]!;

  return (
    <div className="flex flex-col">
      {tabs.length > 1 && (
        <div role="group" aria-label={t('menu.outlet')} className="flex gap-1.5 px-3 pt-1">
          {tabs.map((m, i) => (
            <button
              key={m.key}
              type="button"
              aria-pressed={i === safeTab}
              onClick={() => setPicked(m.key)}
              className={`min-h-8 flex-1 whitespace-nowrap rounded-lg border px-1.5 text-xs font-bold transition-colors ${
                i === safeTab
                  ? 'border-primary bg-primary/10 text-[var(--tone-primary)]'
                  : 'border-base-300 text-base-content/70 hover:text-base-content'
              }`}
            >
              {m.key}
            </button>
          ))}
        </div>
      )}

      {current.kind === 'venue' ? (
        <VenueMenuTab
          pin={current.pin}
          venue={current.venue}
          dayIso={dayIso}
          variant="popover"
          onOpenMap={() => {
            onClose();
            // Bumps mapFocusRequest, on which the extension switches to its
            // map view (useAppLogic) and the canvas flies to the pin.
            focusSocietyPin(current.pin);
          }}
        />
      ) : (
        <div className="flex flex-col gap-2 p-3">
          {current.menu.soup && (
            <div className="flex items-start gap-2">
              <Soup className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/70" />
              <span className="text-xs leading-snug text-base-content/70">{current.menu.soup}</span>
            </div>
          )}
          {current.menu.mainDishes.map((dish, i) => (
            <div key={i} className="flex items-start gap-2">
              <Utensils className="mt-0.5 h-3.5 w-3.5 shrink-0 text-base-content/40" />
              <span className="text-xs leading-snug text-base-content/80">{dish}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
