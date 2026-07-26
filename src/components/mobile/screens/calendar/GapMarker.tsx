import { useTranslation } from '../../../../hooks/useTranslation';

export interface GapMarkerProps {
    minutes: number;
}

/** A dashed-out-feeling divider between two agenda blocks that are far enough apart to be free time. */
export function GapMarker({ minutes }: GapMarkerProps) {
    const { t } = useTranslation();
    const label =
        minutes % 60 === 0
            ? t('mobile.calendar.gap', { hours: minutes / 60 })
            : t('mobile.calendar.gapMinutes', { minutes });

    return (
        <div data-testid="agenda-gap" className="flex items-center gap-2 py-0.5">
            <div className="h-px flex-1 bg-base-300" />
            <span className="text-2xs font-medium text-content-muted">{label}</span>
            <div className="h-px flex-1 bg-base-300" />
        </div>
    );
}
