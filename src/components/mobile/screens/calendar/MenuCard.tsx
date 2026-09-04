import { useEffect } from 'react';
import { ChevronRight } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { menuForDay } from '../../../../utils/menuForDay';
import { pluralSuffix } from '../../../../utils/plural';

/**
 * What the menzas are serving on the selected day, under that day's agenda.
 *
 * The jídelníček existed only in the desktop tree — a chef-hat popover on each
 * weekday column of the weekly grid — so on the phone and the iPad there was no
 * way to reach it at all. The phone has no week to hang icons off; it has one
 * day at a time, which is also the granularity of the question ("what's for
 * lunch today"), so the day's own screen is where it belongs.
 *
 * Summary here, detail in the sheet. The soup is one short line and names the
 * day's character better than a dish count does; the outlet count is the reason
 * to tap. A student who only wanted to know whether it is worth walking over
 * gets an answer without opening anything.
 *
 * Renders NOTHING rather than an empty state when there is no menu for the day.
 * The SKM page carries about two weeks, so most days of the summer are blank,
 * and a permanent "nothing today" box under the agenda is worse than silence —
 * the calendar's own empty state already says the day is free.
 */
export function MenuCard({ dayIso }: { dayIso: string }) {
  const { t, language } = useTranslation();
  const menu = useAppStore((s) => s.menu);
  const menuLoading = useAppStore((s) => s.menuLoading);
  const menuError = useAppStore((s) => s.menuError);
  const fetchMenu = useAppStore((s) => s.fetchMenu);
  const pushSheet = useAppStore((s) => s.pushSheet);

  /**
   * The one fetch. `initializeStore` does not ask for the menu, so without this
   * nothing ever would on the phone — and re-asking when the language changes
   * matters because the menu is scraped per language from two different SKM
   * pages, not translated in the client.
   *
   * Not a data-fetching effect in a component by preference; the store owns the
   * fetch and this is the only surface that wants it, the same arrangement the
   * desktop popover has always had.
   */
  useEffect(() => {
    if (!menu && !menuLoading && !menuError) void fetchMenu();
  }, [menu, menuLoading, menuError, fetchMenu, language]);

  const outlets = menuForDay(menu, new Date(`${dayIso}T00:00:00`));
  if (outlets.length === 0) return null;

  // The first main dish, not the soup. Almost nobody at MENDELU eats the soup,
  // so leading with it summarised the day by the one line most students skip.
  // Soup is the fallback only for an outlet serving nothing else.
  const lead =
    outlets.find((o) => o.mainDishes.length)?.mainDishes[0] ??
    outlets.find((o) => o.soup)?.soup ??
    null;

  return (
    // The padding is the wrapper's and the width is the button's. `mx-4` alone
    // left the card 248px wide in a 375px column: a <button> shrink-wraps its
    // content where the sibling <div> cards (NowNextCard, the holiday strip)
    // fill the line by being blocks, so the one tappable card on the screen was
    // also the only one that did not reach the edge.
    <div className="mt-3 flex-shrink-0 px-4">
      <button
        type="button"
        data-testid="menu-card"
        onClick={() => pushSheet({ kind: 'menu', dayIso })}
        // `border-base-content/10`, not `border-base-300`: this card sits on the
        // calendar's base-200 backdrop, where a base-100 surface measures
        // 1.045:1 — verify:ui flags it as invisible, and in the light theme it
        // genuinely is a white box on a white page. The hairline is what makes
        // it a card in both themes rather than a tone that only works in one.
        className="flex w-full items-center gap-2.5 rounded-2xl border border-base-content/10 bg-base-100 px-3.5 py-2.5 text-left"
      >
        <span className="h-8 w-1 flex-shrink-0 rounded-full bg-primary" />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="truncate text-md font-bold text-base-content">{t('menu.title')}</span>
          <span className="truncate text-2sm text-base-content/60">
            {lead ?? outlets.map((o) => o.outlet).join(' · ')}
          </span>
        </span>
        <span className="flex-shrink-0 whitespace-nowrap text-2sm font-bold text-base-content">
          {/* Czech needs all three forms at these counts: there are three
              outlets, so 1 / 2-4 / 5+ are all reachable. */}
          {t(`menu.outlet${pluralSuffix(language, outlets.length)}`, { count: outlets.length })}
        </span>
        <ChevronRight size={16} className="flex-shrink-0 text-base-content/40" aria-hidden />
      </button>
    </div>
  );
}
