import { useEffect, useRef, useState } from 'react';
import type { TimelinePoint } from '../../../../utils/mobile/examTimeline';
import { layoutExamTimeline } from '../../../../utils/mobile/examTimelineLayout';

export interface ExamTimelineProps {
  points: TimelinePoint[];
  now: Date;
}

/**
 * The registered exams laid out along a rail **by date**, so the gaps carry
 * information — four exams across a month look nothing like four in one week.
 * Terms too close together to sit side by side merge into an "N×" column
 * instead of overlapping; all the geometry lives in `layoutExamTimeline`, which
 * needs the rail's real width, measured here.
 */
export function ExamTimeline({ points, now }: ExamTimelineProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const el = railRef.current;
    if (!el) return;
    // Width drives the clustering threshold, so it has to track rotation and
    // any container change — not just the first paint.
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const { columns, progressPct } = layoutExamTimeline(points, now, width);
  if (points.length === 0) return null;

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
      <div ref={railRef} className="absolute left-5 right-5 top-0">
        {columns.map((col) => (
          <div
            key={col.id}
            style={{ left: `${col.leftPct}%` }}
            className="absolute top-0 flex -translate-x-1/2 flex-col items-center gap-1"
          >
            <span
              className={`rounded-full border-2 border-base-100 bg-primary ${
                col.count > 1 ? 'h-3 w-3' : 'h-2.5 w-2.5'
              }`}
            />
            <span className="whitespace-nowrap text-xs font-bold text-base-content">
              {col.title}
            </span>
            <span className="whitespace-nowrap text-xs text-base-content/60">{col.subtitle}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
