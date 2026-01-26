import { HOURS, DAYS } from './utils';

const TOTAL_HOURS = 13;

export function WeeklyCalendarGrid() {
    return (
        <div className="absolute inset-0 flex pointer-events-none">
            {DAYS.map((_, dayIndex) => (
                <div key={dayIndex} className="flex-1 border-r border-base-300 last:border-r-0">
                    {HOURS.map((_, hourIndex) => (
                        <div
                            key={hourIndex}
                            className="border-b border-base-200"
                            style={{ height: `${100 / TOTAL_HOURS}%` }}
                        ></div>
                    ))}
                </div>
            ))}
        </div>
    );
}
