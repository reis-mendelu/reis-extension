import type { TimelinePoint } from '../../../../utils/mobile/examTimeline';

export interface ExamTimelineProps {
    points: TimelinePoint[];
}

/**
 * How far `now` sits between the nearest and furthest registered term, as a
 * percentage of that span. `points` are sorted nearest-first (ascending date),
 * so `points[0].daysLeft` is the smallest (possibly negative, if overdue) and
 * the last point's `daysLeft` is the largest. `-first.daysLeft` days have
 * elapsed since the first term out of the full `first..last` span; clamped to
 * [0, 100] since `now` can sit before the first term or (rarely) after the
 * last one already passed.
 */
function elapsedProgressPct(points: TimelinePoint[]): number {
    if (points.length < 2) return 0;
    const first = points[0];
    const last = points[points.length - 1];
    const totalSpanDays = last.daysLeft - first.daysLeft;
    if (totalSpanDays <= 0) return 0;
    const elapsedDays = -first.daysLeft;
    return Math.min(100, Math.max(0, (elapsedDays / totalSpanDays) * 100));
}

/** Dots for every registered term, evenly spaced by index (nearest-first order comes from buildExamTimeline). */
export function ExamTimeline({ points }: ExamTimelineProps) {
    if (points.length === 0) return null;
    const lastIndex = points.length - 1;
    const progressPct = elapsedProgressPct(points);

    return (
        <div className="relative mt-3.5 h-14 flex-shrink-0 px-5">
            {/* base-content/15, not base-300: this rail sits on the screen's
                base-200 background, and in the dark theme base-300 (#0f172a) is
                DARKER than base-200 (#111827) — the track rendered as an
                invisible line. base-300 only reads as a divider on a base-100
                card or sheet. */}
            <div className="absolute left-5 right-5 top-3 h-0.5 overflow-hidden rounded-full bg-base-content/15">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="absolute left-5 right-5 top-0">
                {points.map((point, index) => {
                    // The end dots sit exactly on the rail's ends, so a centred
                    // label there would hang half its width off the screen —
                    // which is what happened as soon as there was more than one
                    // point. Anchor the first column's left edge and the last
                    // column's right edge instead; only the middle ones centre.
                    const isFirst = index === 0 && lastIndex !== 0;
                    const isLast = index === lastIndex && lastIndex !== 0;
                    const position = isFirst
                        ? { style: { left: '0%' }, align: 'items-start' }
                        : isLast
                            ? { style: { right: '0%' }, align: 'items-end' }
                            : { style: { left: `${lastIndex === 0 ? 50 : (index / lastIndex) * 100}%` }, align: 'items-center -translate-x-1/2' };
                    return (
                        <div
                            key={point.id}
                            style={position.style}
                            className={`absolute top-0 flex flex-col gap-1 ${position.align}`}
                        >
                            <span className="h-2.5 w-2.5 rounded-full border-2 border-base-100 bg-primary" />
                            <span className="whitespace-nowrap text-xs font-bold text-base-content">{point.subjectCode}</span>
                            {/* Day and month only — the full date and time are on
                                the card below, and four full timestamps cannot
                                fit a phone width without colliding. */}
                            <span className="whitespace-nowrap text-xs text-base-content/60">{point.shortLabel}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
