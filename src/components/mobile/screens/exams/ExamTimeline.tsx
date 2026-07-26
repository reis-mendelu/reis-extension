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
            <div className="absolute left-5 right-5 top-3 h-0.5 overflow-hidden rounded-full bg-base-300">
                <div className="h-full rounded-full bg-primary" style={{ width: `${progressPct}%` }} />
            </div>
            <div className="absolute left-5 right-5 top-0">
                {points.map((point, index) => {
                    const leftPct = lastIndex === 0 ? 50 : (index / lastIndex) * 100;
                    return (
                        <div
                            key={point.id}
                            style={{ left: `${leftPct}%` }}
                            className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
                        >
                            <span className="h-2.5 w-2.5 rounded-full border-2 border-base-100 bg-primary" />
                            <span className="whitespace-nowrap text-2xs font-bold text-base-content">{point.subjectCode}</span>
                            <span className="whitespace-nowrap text-2xs text-base-content/60">{point.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
