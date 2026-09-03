import { AlertTriangle } from 'lucide-react';
import type { DeadlineAlert } from '../../../../hooks/useDeadlineAlerts';

export interface CalendarAlertsProps {
  alerts: DeadlineAlert[];
}

/**
 * Deadline warnings above the day's agenda — exam registrations closing,
 * mostly. Capped at three: past that they stop reading as urgent and start
 * pushing the timetable off the screen, which is the thing the student came
 * for.
 */
export function CalendarAlerts({ alerts }: CalendarAlertsProps) {
  if (alerts.length === 0) return null;
  return (
    <div className="mx-4 mt-3 flex flex-shrink-0 flex-col gap-2">
      {alerts.slice(0, 3).map((alert) => (
        <div
          key={alert.id}
          className="flex items-center gap-2.5 rounded-xl border border-warning/25 bg-warning/10 px-3 py-2.5"
        >
          <AlertTriangle size={16} className="flex-shrink-0 text-warning" />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-semibold text-base-content">{alert.title}</span>
            <span className="truncate text-xs text-base-content/70">{alert.body}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
