import { HOURS } from './utils';

const TOTAL_HOURS = 14;

export function WeeklyCalendarGrid({ dayCount }: { dayCount: number }) {
  return (
    <div className="absolute inset-0 flex pointer-events-none">
      {Array.from({ length: dayCount }, (_, i) => i).map((dayIndex) => (
        <div key={dayIndex} className="flex-1 border-r border-base-content/10 last:border-r-0">
          {HOURS.map((_, hourIndex) => (
            <div
              key={hourIndex}
              className="border-b border-base-content/8"
              style={{ height: `${100 / TOTAL_HOURS}%` }}
            ></div>
          ))}
        </div>
      ))}
    </div>
  );
}
