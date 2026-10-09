import { List, Table } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { MobileCalendarView } from '../../../../store/types';

/**
 * Day agenda or week grid — the only control floating above the tab bar.
 *
 * Icons, not words. It shipped in the mockups as "Den | Týden" beside the
 * floating "Dnes" pill, and the three similar words in a row read as one
 * confusing control. "Dnes" became the date in the header (ScreenHeader's
 * `titleAction`), and the switch says what it switches between by picture: a
 * list, a grid. The names stay as the buttons' accessible labels.
 *
 * Placed and dressed like the bar under it, 8px above it, the spot the Dnes
 * pill held: `bottom-[84px]` clears BottomNav (18px inset + its ~54px height +
 * a gap). The week grid reserves this band so the switch never covers a lesson;
 * the agenda already pads `pb-36` for it.
 */
export function CalendarViewSwitch() {
  const { t } = useTranslation();
  const view = useAppStore((s) => s.mobileCalendarView);
  const setView = useAppStore((s) => s.saveCalendarView);

  const option = (value: MobileCalendarView, label: string, Icon: typeof List) => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={view === value}
      onClick={() => setView(value)}
      // Tonal, like BottomNav's active tab: --tone-primary on the /15 tint, not
      // raw primary, which measured 2.03:1 in the light theme.
      className={`flex min-h-9 min-w-11 items-center justify-center rounded-full transition-colors ${
        view === value ? 'bg-primary/15 text-[var(--tone-primary)]' : 'text-base-content/70'
      }`}
    >
      <Icon size={20} />
    </button>
  );

  return (
    <div
      role="group"
      aria-label={t('mobile.calendar.viewLabel')}
      className="absolute bottom-[calc(84px_+_var(--safe-bottom,0px))] left-1/2 z-30 flex -translate-x-1/2 items-center rounded-full border border-base-300 bg-base-100 p-1 shadow-drawer"
    >
      {option('day', t('mobile.calendar.dayView'), List)}
      {option('week', t('mobile.calendar.weekView'), Table)}
    </div>
  );
}
