import type { DateInfo } from '../../types/calendarTypes';
import { DAYS } from './utils';
import { useTranslation } from '../../hooks/useTranslation';

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
            {DAYS.map((_, index) => {
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
                            <div className={`text-lg font-semibold leading-tight ${holiday ? 'text-error' : isToday ? 'text-current-day' : 'text-base-content'}`}>
                                {dateInfo?.day}
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
