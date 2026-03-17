import { useEffect, useRef, useState } from 'react';
import { ChefHat, Soup, Utensils, UtensilsCrossed } from 'lucide-react';
import type { DateInfo } from '../../types/calendarTypes';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

// ─── isTodayMatch ───────────────────────────────────────────────────────────

function isTodayMatch(dateStr: string): boolean {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const match = dateStr.match(/(\d+)\.\s*(\d+)\./);
    if (!match) return false;
    return parseInt(match[1]) === day && parseInt(match[2]) === month;
}

// ─── MenuPopoverContent ──────────────────────────────────────────────────────

function MenuPopoverContent() {
    const { t } = useTranslation();
    const menu = useAppStore((s) => s.menu);
    const menuLoading = useAppStore((s) => s.menuLoading);
    const menuError = useAppStore((s) => s.menuError);
    const fetchMenu = useAppStore((s) => s.fetchMenu);
    const [activeTab, setActiveTab] = useState(0);

    useEffect(() => {
        if (!menu && !menuLoading && !menuError) {
            fetchMenu();
        }
    }, [menu, menuLoading, menuError, fetchMenu]);

    if (menuLoading) {
        return (
            <div className="flex items-center justify-center py-6">
                <span className="loading loading-spinner loading-md text-primary" />
            </div>
        );
    }

    if (menuError) {
        return (
            <div className="flex flex-col items-center gap-2 py-5 text-center">
                <UtensilsCrossed className="w-6 h-6 text-base-content/30" />
                <p className="text-xs text-base-content/50">{t('menu.unavailable')}</p>
            </div>
        );
    }

    const matched = (menu ?? [])
        .map((outlet) => {
            const todayMenu = outlet.days.find((d) => isTodayMatch(d.date));
            if (!todayMenu) return null;
            if (!todayMenu.soup && todayMenu.mainDishes.length === 0) return null;
            return { outlet: outlet.outlet, ...todayMenu };
        })
        .filter(Boolean) as { outlet: string; soup: string | null; mainDishes: string[] }[];

    if (matched.length === 0) {
        return (
            <div className="flex flex-col items-center gap-2 py-5 text-center">
                <UtensilsCrossed className="w-6 h-6 text-base-content/30" />
                <p className="text-xs text-base-content/50">{t('menu.unavailable')}</p>
            </div>
        );
    }

    const safeIndex = Math.min(activeTab, matched.length - 1);
    const current = matched[safeIndex];

    return (
        <div className="flex flex-col">
            {/* Tabs */}
            <div role="tablist" className="flex border-b border-base-300">
                {matched.map((m, i) => (
                    <button
                        key={m.outlet}
                        role="tab"
                        onClick={() => setActiveTab(i)}
                        className={`flex-1 py-2 text-xs font-bold transition-colors border-b-2 -mb-px ${
                            i === safeIndex
                                ? 'border-primary text-primary'
                                : 'border-transparent text-base-content/40 hover:text-base-content/70'
                        }`}
                    >
                        {m.outlet}
                    </button>
                ))}
            </div>

            {/* Dish list */}
            <div className="flex flex-col gap-2 p-3 max-h-64 overflow-y-auto">
                {current.soup && (
                    <div className="flex items-start gap-2">
                        <Soup className="w-3.5 h-3.5 mt-0.5 shrink-0 text-primary/70" />
                        <span className="text-xs text-base-content/70 leading-snug">{current.soup}</span>
                    </div>
                )}
                {current.mainDishes.map((dish, i) => (
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
    const [menuOpen, setMenuOpen] = useState(false);
    const popoverRef = useRef<HTMLDivElement>(null);

    // Close popover on outside click
    useEffect(() => {
        if (!menuOpen) return;
        const handler = (e: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [menuOpen]);

    return (
        <div className="relative z-20 flex border-b border-base-300 bg-base-100 flex-shrink-0 h-[48px]">
            <div className="w-12 border-r border-base-300 bg-base-200" />
            {[0, 1, 2, 3, 4].map((index) => {
                const dateInfo = weekDates[index];
                const isToday = index === todayIndex;
                const holiday = holidaysByDay[index];

                return (
                    <div
                        key={index}
                        className={`flex-1 relative py-1 px-2 text-center border-r border-base-300 last:border-r-0
                                   ${isToday ? 'bg-current-day-header' : ''}`}
                    >
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="flex flex-row items-center gap-1 justify-center">
                                <div className={`text-lg font-semibold leading-tight ${holiday ? 'text-error' : isToday ? 'text-current-day' : 'text-base-content'}`}>
                                    {dateInfo?.day}
                                </div>
                            </div>
                            <div className={`text-[13px] leading-tight ${holiday ? 'text-error' : 'text-base-content'}`}>
                                {t(`days.${dayKeys[index]}`)}
                            </div>
                        </div>

                        {/* ChefHat icon — only on today's column, right-aligned */}
                        {isToday && (
                            <div ref={popoverRef} className="absolute top-0 right-1 bottom-0 flex items-center">
                                <button
                                    type="button"
                                    onClick={() => setMenuOpen((v) => !v)}
                                    className={`btn btn-ghost btn-xs btn-circle p-0 min-h-0 h-7 w-7 transition-colors ${
                                        menuOpen ? 'text-primary bg-primary/10' : 'text-base-content/40 hover:text-base-content'
                                    }`}
                                    title={t('menu.title')}
                                >
                                    <ChefHat className="w-5 h-5" />
                                </button>

                                {/* Popover — anchored to the full width of this day column */}
                                {menuOpen && (
                                    <div className="absolute top-full right-0 mt-1 w-64 bg-base-100 rounded-box shadow-xl border border-base-300 overflow-hidden z-50">
                                        <div className="flex items-center gap-2 px-3 pt-3 pb-1">
                                            <ChefHat className="w-4 h-4 text-primary" />
                                            <span className="text-xs font-bold text-base-content">
                                                {t('menu.title')}
                                            </span>
                                        </div>
                                        <MenuPopoverContent />
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
