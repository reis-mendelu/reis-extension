import type { NowNext } from '../../../../utils/mobile/nowNext';
import { useTranslation } from '../../../../hooks/useTranslation';
import { localizedCourseName, localizedRoom } from '../../../../utils/localizedLesson';

export function NowNextCard({ data, onRoute }: { data: NowNext; onRoute: () => void }) {
    const { t, language } = useTranslation();
    const { current, next, elapsedPct, minutesLeft } = data;
    // Teacher has fullName/shortName, not `.name` — the prototype's placeholder
    // data used a plain `.name` field that doesn't exist on the real type.
    const teacher = current.teachers[0]?.fullName ?? '';
    const currentName = localizedCourseName(current, language);
    const currentRoom = localizedRoom(current, language);
    const nextName = next ? localizedCourseName(next, language) : '';
    const nextRoom = next ? localizedRoom(next, language) : '';

    return (
        <div
            data-testid="now-next-card"
            className="mx-4 mt-3.5 flex flex-shrink-0 flex-col gap-2.5 rounded-2xl border border-primary/25 bg-base-100 p-4"
        >
            <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-2xs font-bold uppercase tracking-wider text-primary">
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    {t('mobile.calendar.nowRunning')}
                </span>
                <span className="text-xs font-semibold text-base-content/60">
                    {t('mobile.calendar.endsIn', { minutes: minutesLeft })}
                </span>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="font-display text-lg font-bold tracking-tight">{currentName}</span>
                <span className="text-xs text-base-content/70">
                    {currentRoom} · {current.startTime} – {current.endTime}
                    {teacher && ` · ${teacher}`}
                </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-base-300">
                <div className="h-full rounded-full bg-primary" style={{ width: `${elapsedPct}%` }} />
            </div>
            {next && (
                <div className="flex items-center justify-between pt-0.5">
                    <span className="text-xs font-medium text-base-content/60">
                        {t('mobile.calendar.next', { title: `${nextName} · ${nextRoom} · ${next.startTime}` })}
                    </span>
                    <button onClick={onRoute} className="py-1.5 pl-3 text-xs font-semibold text-primary">
                        {t('mobile.calendar.route')}
                    </button>
                </div>
            )}
        </div>
    );
}
