import type { AgendaRow } from '../../../../utils/mobile/dayAgenda';
import { AgendaEvent } from './AgendaEvent';
import { GapMarker } from './GapMarker';

export interface DayAgendaProps {
    rows: AgendaRow[];
    onOpenEvent: (eventId: string) => void;
}

/** The day's timeline: a start/end rail on the left, event cards and gap markers on the right. */
export function DayAgenda({ rows, onOpenEvent }: DayAgendaProps) {
    const events = rows.filter((r): r is Extract<AgendaRow, { type: 'event' }> => r.type === 'event');
    const railStart = events[0]?.lesson.startTime ?? '';
    const railEnd = events[events.length - 1]?.lesson.endTime ?? '';

    return (
        <div data-testid="day-agenda" className="flex gap-3 px-4">
            <div className="flex flex-shrink-0 flex-col items-center pt-1">
                <span className="text-xs font-medium text-base-content/60">{railStart}</span>
                <div className="my-1 w-0.5 flex-1 rounded-full bg-gradient-to-b from-primary to-base-300" />
                <span className="text-xs font-medium text-base-content/60">{railEnd}</span>
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2.5 pb-8">
                {rows.map((row, i) =>
                    row.type === 'gap' ? (
                        <GapMarker key={`gap-${i}`} minutes={row.minutes} />
                    ) : (
                        <AgendaEvent
                            key={row.lesson.id}
                            lesson={row.lesson}
                            onOpen={() => onOpenEvent(row.lesson.id)}
                        />
                    )
                )}
            </div>
        </div>
    );
}
