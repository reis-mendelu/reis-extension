import { useEffect, useRef, useState } from 'react';
import { ChefHat, Soup, Utensils, UtensilsCrossed } from 'lucide-react';
import type { DateInfo } from '../../types/calendarTypes';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

// ─── helpers ─────────────────────────────────────────────────────────────────

/** Returns JS week-day index (0 = Mon … 4 = Fri) for a date string like "17. 3." */
function dateStrToDayIndex(dateStr: string): number {
    const now = new Date();
    const match = dateStr.match(/(\d+)\.\s*(\d+)\./);
    if (!match) return -1;
    const d = parseInt(match[1]);
    const m = parseInt(match[2]);
    const year = now.getFullYear();
    // JS getDay(): 0=Sun, 1=Mon … so subtract 1 and wrap
    const jsDay = new Date(year, m - 1, d).getDay();
    return jsDay === 0 ? 6 : jsDay - 1; // 0=Mon … 4=Fri, 5-6=weekend
}


// ─── MenuPopoverContent ──────────────────────────────────────────────────────

function MenuPopoverContent({ initialDay }: { initialDay: number }) {
    const { t } = useTranslation();
    const menu = useAppStore((s) => s.menu);
    const menuLoading = useAppStore((s) => s.menuLoading);
    const menuError = useAppStore((s) => s.menuError);
    const fetchMenu = useAppStore((s) => s.fetchMenu);

    const [activeTab, setActiveTab] = useState(0);

    // Reset tab when the day changes (user clicked a different column's icon)
    const prevDay = useRef(initialDay);
    useEffect(() => {
        if (prevDay.current !== initialDay) {
            prevDay.current = initialDay;
            setActiveTab(0);
        }
    }, [initialDay]);

    useEffect(() => {
        if (!menu && !menuLoading && !menuError) fetchMenu();
    }, [menu, menuLoading, menuError, fetchMenu]);

    if (menuLoading) {
        return (
            <div className="flex items-center justify-center py-6">
                <span className="loading loading-spinner loading-md text-primary" />
            </div>
        );
    }

    if (menuError || !menu?.length) {
        return (
            <div className="flex flex-col items-center gap-2 py-5 text-center">
                <UtensilsCrossed className="w-6 h-6 text-base-content/30" />
                <p className="text-xs text-base-content/50">{t('menu.unavailable')}</p>
            </div>
        );
    }

    const outletsForDay = menu
        .map((outlet) => {
            const dayEntry = outlet.days.find((d) => dateStrToDayIndex(d.date) === initialDay);
            if (!dayEntry || (!dayEntry.soup && dayEntry.mainDishes.length === 0)) return null;
            return { outlet: outlet.outlet, soup: dayEntry.soup, mainDishes: dayEntry.mainDishes };
        })
        .filter(Boolean) as { outlet: string; soup: string | null; mainDishes: string[] }[];

    if (outletsForDay.length === 0) {
        return (
            <div className="flex flex-col items-center gap-1.5 py-4 text-center">
                <UtensilsCrossed className="w-5 h-5 text-base-content/20" />
                <p className="text-xs text-base-content/40">{t('menu.unavailable')}</p>
            </div>
        );
    }

    const safeTab = Math.min(activeTab, outletsForDay.length - 1);
    const current = outletsForDay[safeTab];

    return (
        <div className="flex flex-col">
            {/* Outlet tabs */}
            <div role="tablist" className="flex border-b border-base-300">
                {outletsForDay.map((m, i) => (
                    <button
                        key={m.outlet}
                        role="tab"
                        onClick={() => setActiveTab(i)}
                        className={`flex-1 py-1.5 text-xs font-bold transition-colors border-b-2 -mb-px ${
                            i === safeTab
                                ? 'border-primary text-primary'
                                : 'border-transparent text-base-content/40 hover:text-base-content/70'
                        }`}
                    >
                        {m.outlet}
                    </button>
                ))}
            </div>

            {/* Dish list */}
            <div className="flex flex-col gap-2 p-3">
                {current?.soup && (
                    <div className="flex items-start gap-2">
                        <Soup className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" />
                        <span className="text-xs text-base-content/70 leading-snug">{current.soup}</span>
                    </div>
                )}
                {current?.mainDishes.map((dish, i) => (
                    <div key={i} className="flex items-start gap-2">
                        <Utensils className="w-3.5 h-3.5 mt-0.5 shrink-0 text-base-content/40" />
                        <span className="text-xs text-base-content/80 leading-snug">{dish}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ─── WeeklyCalendarHeader ────────────────────────────────────────────────────

interface WeeklyCalendarHeaderProps {
    weekDates: DateInfo[];
    todayIndex: number;
    holidaysByDay: (string | null)[];
}

export function WeeklyCalendarHeader({ weekDates, todayIndex, holidaysByDay }: WeeklyCalendarHeaderProps) {
    const { t } = useTranslation();
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
    const menu = useAppStore((s) => s.menu);
    const fetchMenu = useAppStore((s) => s.fetchMenu);
    const menuLoading = useAppStore((s) => s.menuLoading);
    const menuError = useAppStore((s) => s.menuError);

    // Trigger fetch once on mount if needed
    useEffect(() => {
        if (!menu && !menuLoading && !menuError) fetchMenu();
    }, [menu, menuLoading, menuError, fetchMenu]);

    // Which calendar day-column index (0-4) has menu data?
    // Build a set of "day.month" date keys that have menu data, e.g. "19.3"
    const daysWithMenu = new Set<string>(
        (menu ?? []).flatMap((outlet) =>
            outlet.days
                .filter((d) => d.soup || d.mainDishes.length > 0)
                .map((d) => {
                    const m = d.date.match(/(\d+)\.\s*(\d+)\./);
                    return m ? `${parseInt(m[1])}.${parseInt(m[2])}` : '';
                })
                .filter(Boolean)
        )
    );

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
            <div className="w-12 border-r border-base-300 bg-base-200" />
            {[0, 1, 2, 3, 4].map((index) => {
                const dateInfo = weekDates[index];
                const isToday = index === todayIndex;
                const holiday = holidaysByDay[index];
                // Exact date key for this column, e.g. "19.3"
                const colDateKey = dateInfo ? `${parseInt(dateInfo.day)}.${parseInt(dateInfo.month)}` : '';
                // Mon-based weekday index — only used to tell MenuPopoverContent which day to show
                const colDayIndex = dateInfo ? dateStrToDayIndex(`${dateInfo.day}. ${dateInfo.month}.`) : -1;
                const hasMenu = !holiday && daysWithMenu.has(colDateKey);
                const isOpen = openDayKey === colDateKey;

                return (
                    <div
                        key={index}
                        className={`flex-1 relative py-1 px-2 text-center border-r border-base-300 last:border-r-0
                                   ${isToday ? 'bg-current-day-header' : ''}`}
                    >
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className={`text-lg font-semibold leading-tight ${holiday ? 'text-error' : isToday ? 'text-current-day' : 'text-base-content'}`}>
                                {dateInfo?.day}
                            </div>
                            <div className={`text-[13px] leading-tight ${holiday ? 'text-error' : 'text-base-content'}`}>
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
                                        isOpen ? 'text-primary bg-primary/10' : 'text-base-content/30 hover:text-base-content'
                                    }`}
                                    title={t('menu.title')}
                                >
                                    <ChefHat className="w-5 h-5" />
                                </button>

                                {isOpen && (
                                    <div className="absolute top-full right-0 mt-1 w-64 bg-base-100 rounded-box shadow-xl border border-base-300 overflow-hidden z-50">
                                        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                                            <ChefHat className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-bold text-base-content">
                                                {t('menu.title')}
                                            </span>
                                        </div>
                                        <MenuPopoverContent initialDay={colDayIndex} />
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
