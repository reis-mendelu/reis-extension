import { useTranslation } from '../../../../hooks/useTranslation';

export interface GapMarkerProps {
    minutes: number;
}

/** A dashed-out-feeling divider between two agenda blocks that are far enough
 *  apart to be free time. The rules use base-content/15 rather than base-300:
 *  they sit on the screen's base-200 background, where the dark theme's
 *  base-300 (#0f172a) is the darker of the two and vanishes. */
export function GapMarker({ minutes }: GapMarkerProps) {
    const { t } = useTranslation();
    const label =
        minutes % 60 === 0
            ? t('mobile.calendar.gap', { hours: minutes / 60 })
            : t('mobile.calendar.gapMinutes', { minutes });

    return (
        <div data-testid="agenda-gap" className="flex items-center gap-2 py-0.5">
            <div className="h-px flex-1 bg-base-content/15" />
            <span className="text-xs font-medium text-base-content/60">{label}</span>
            <div className="h-px flex-1 bg-base-content/15" />
        </div>
    );
}
