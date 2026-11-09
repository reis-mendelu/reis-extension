import { useEffect, useRef, useState } from 'react';
import { ChefHat } from 'lucide-react';
import type { DateInfo } from '../../types/calendarTypes';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { useIsHalloween } from '../../hooks/ui/useHalloween';
import { Cobweb } from '../halloween/HalloweenArt';
import { menuForDay } from '../../utils/menuForDay';
import { MenuPopoverContent } from './MenuPopoverContent';

// ─── WeeklyCalendarHeader ────────────────────────────────────────────────────

interface WeeklyCalendarHeaderProps {
  weekDates: DateInfo[];
  todayIndex: number;
  holidaysByDay: (string | null)[];
  /** Columns to label — five, or six/seven when the weekend is taught. */
  dayCount: number;
}

export function WeeklyCalendarHeader({
  weekDates,
  todayIndex,
  holidaysByDay,
  dayCount,
}: WeeklyCalendarHeaderProps) {
  const { t, language } = useTranslation();
  const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const menu = useAppStore((s) => s.menu);
  const halloween = useIsHalloween();

  const locale = language === 'en' ? 'en-GB' : 'cs-CZ';

  const [openDayKey, setOpenDayKey] = useState<string | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (openDayKey === null) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpenDayKey(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [openDayKey]);

  return (
    <div className="relative z-20 flex border-b border-base-300 bg-base-100 flex-shrink-0 h-[48px]">
      {/* The corner above the hours never holds a day or a lesson, which is
          why the Halloween week's cobweb lives here. */}
      <div className="w-12 border-r border-base-300 bg-base-200">
        {halloween && <Cobweb className="h-full w-full text-base-content/25" />}
      </div>
      {Array.from({ length: dayCount }, (_, i) => i).map((index) => {
        const dateInfo = weekDates[index];
        const isToday = index === todayIndex;
        const holiday = holidaysByDay[index];
        // The column's day, 'YYYY-MM-DD'; also the key of its open popover.
        const colDateKey = dateInfo
          ? `${dateInfo.year}-${dateInfo.month.padStart(2, '0')}-${dateInfo.day.padStart(2, '0')}`
          : '';
        const colDate = new Date(`${colDateKey}T00:00:00`);
        // The hat goes where SKM serves; S-klub joins inside, as a tab.
        const hasMenu = !holiday && !!dateInfo && menuForDay(menu, colDate).length > 0;
        const isOpen = openDayKey === colDateKey;

        return (
          <div
            key={index}
            className={`flex-1 relative py-1 px-2 text-center border-r border-base-300 last:border-r-0
                                   ${isToday ? 'bg-current-day-header' : ''}`}
          >
            <div className="flex flex-col items-center justify-center h-full">
              <div
                className={`text-lg font-semibold leading-tight ${holiday ? 'text-[var(--tone-error)]' : isToday ? 'text-current-day' : 'text-base-content'}`}
              >
                {dateInfo?.day}
              </div>
              <div
                className={`text-[13px] leading-tight ${holiday ? 'text-error' : 'text-base-content'}`}
              >
                {t(`days.${dayKeys[index]}`)}
              </div>
            </div>

            {/* ChefHat — on every day with menu data */}
            {hasMenu && (
              <div
                ref={isOpen ? popoverRef : undefined}
                className="absolute top-0 right-1 bottom-0 flex items-center"
              >
                <button
                  type="button"
                  onClick={() => setOpenDayKey(isOpen ? null : colDateKey)}
                  className={`btn btn-ghost btn-xs btn-circle p-0 min-h-0 h-7 w-7 transition-colors ${
                    isOpen
                      ? 'text-primary bg-primary/10'
                      : 'text-base-content/30 hover:text-base-content'
                  }`}
                  title={t('menu.title')}
                  aria-label={t('menu.title')}
                  aria-expanded={isOpen}
                >
                  <ChefHat className="w-5 h-5" />
                </button>

                {isOpen && (
                  <div
                    className={`absolute top-full mt-1 w-96 max-w-[calc(100vw-4rem)] bg-base-100 rounded-box shadow-xl border border-base-300 overflow-hidden z-50 text-left ${index <= 1 ? 'left-0' : 'right-0'}`}
                  >
                    <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                      <ChefHat className="w-4 h-4 text-primary" />
                      <span className="text-xs font-bold text-base-content">{t('menu.title')}</span>
                      <span className="ml-auto text-xs text-base-content/70">
                        {colDate.toLocaleDateString(locale, {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'numeric',
                        })}
                      </span>
                    </div>
                    <MenuPopoverContent
                      key={colDateKey}
                      dayIso={colDateKey}
                      onClose={() => setOpenDayKey(null)}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
