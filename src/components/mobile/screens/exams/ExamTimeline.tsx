import type { TimelinePoint } from '../../../../utils/mobile/examTimeline';

export interface ExamTimelineProps {
    points: TimelinePoint[];
}

/** Dots for every registered term, evenly spaced by index (nearest-first order comes from buildExamTimeline). */
export function ExamTimeline({ points }: ExamTimelineProps) {
    if (points.length === 0) return null;
    const lastIndex = points.length - 1;

    return (
        <div className="relative mt-3.5 h-14 flex-shrink-0 px-5">
            <div className="absolute left-5 right-5 top-3 h-0.5 rounded-full bg-base-300" />
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
                            <span className="whitespace-nowrap text-2xs font-bold text-content-primary">{point.subjectCode}</span>
                            <span className="whitespace-nowrap text-2xs text-content-muted">{point.label}</span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
