import { useEffect } from 'react';
import { UtensilsCrossed } from 'lucide-react';
import type { DateInfo } from '../../types/calendarTypes';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';

function MenuDropdownContent() {
    const { t } = useTranslation();
    const menu = useAppStore((s) => s.menu);
    const menuLoading = useAppStore((s) => s.menuLoading);
    const menuError = useAppStore((s) => s.menuError);
    const fetchMenu = useAppStore((s) => s.fetchMenu);

    useEffect(() => {
        if (!menu && !menuLoading && !menuError) {
            fetchMenu();
        }
    }, [menu, menuLoading, menuError, fetchMenu]);

    if (menuLoading) {
        return <div className="text-center py-2"><span className="loading loading-spinner loading-sm" /></div>;
    }

    if (!menu || menu.length === 0) {
        return <div className="text-sm text-base-content/60">{t('menu.unavailable')}</div>;
    }

    const matched = menu
        .map((outlet) => {
            const todayMenu = outlet.days.find((d) => isTodayMatch(d.date));
            if (!todayMenu) return null;
            if (!todayMenu.soup && todayMenu.mainDishes.length === 0) return null;
            return { outlet: outlet.outlet, ...todayMenu };
        })
        .filter(Boolean);

    if (matched.length === 0) {
        return <div className="text-sm text-base-content/60">{t('menu.unavailable')}</div>;
    }

    return (
        <div className="flex flex-col gap-3 max-h-80 overflow-y-auto">
            {matched.map((m) => (
                <div key={m!.outlet}>
                    <div className="font-semibold text-sm text-base-content">{m!.outlet}</div>
                    {m!.soup && (
                        <div className="text-xs text-base-content/70 mt-0.5">🍲 {m!.soup}</div>
                    )}
                    {m!.mainDishes.map((dish, i) => (
                        <div key={i} className="text-xs text-base-content/70 mt-0.5">🍽️ {dish}</div>
                    ))}
                </div>
            ))}
        </div>
    );
}

function isTodayMatch(dateStr: string): boolean {
    const now = new Date();
    const day = now.getDate();
    const month = now.getMonth() + 1;
    const match = dateStr.match(/(\d+)\.\s*(\d+)\./);
    if (!match) return false;
    return parseInt(match[1]) === day && parseInt(match[2]) === month;
}

interface WeeklyCalendarHeaderProps {
    weekDates: DateInfo[];
    todayIndex: number;
    holidaysByDay: (string | null)[];
}

export function WeeklyCalendarHeader({ weekDates, todayIndex, holidaysByDay }: WeeklyCalendarHeaderProps) {
    const { t } = useTranslation();
    const dayKeys = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    return (
        <div className="flex border-b border-base-300 bg-base-100 flex-shrink-0 h-[48px]">
            <div className="w-12 border-r border-base-300 bg-base-200"></div>
            {[0, 1, 2, 3, 4].map((index) => {
                const dateInfo = weekDates[index];
                const isToday = index === todayIndex;
                const holiday = holidaysByDay[index];

                return (
                    <div
                        key={index}
                        className={`flex-1 py-1 px-2 text-center border-r border-base-300 last:border-r-0
                                   ${isToday ? 'bg-current-day-header' : ''}`}
                    >
                        <div className="flex flex-col items-center justify-center h-full">
                            <div className="flex flex-row items-center gap-1 justify-center">
                                <div className={`text-lg font-semibold leading-tight ${holiday ? 'text-error' : isToday ? 'text-current-day' : 'text-base-content'}`}>
                                    {dateInfo?.day}
                                </div>
                                {isToday && (
                                    <div className="dropdown dropdown-bottom dropdown-end">
                                        <button
                                            type="button"
                                            tabIndex={0}
                                            className="btn btn-ghost btn-xs btn-circle p-0 min-h-0 h-5 w-5"
                                        >
                                            <UtensilsCrossed className="w-3.5 h-3.5 text-base-content/50 hover:text-base-content" />
                                        </button>
                                        <div tabIndex={0} className="dropdown-content z-50 bg-base-100 rounded-box p-4 shadow-lg border border-base-300 w-64 mt-1">
                                            <MenuDropdownContent />
                                        </div>
                                    </div>
                                )}
                            </div>
                            <div className={`text-[13px] leading-tight ${holiday ? 'text-error' : 'text-base-content'}`}>
                                {t(`days.${dayKeys[index]}`)}
                            </div>
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
