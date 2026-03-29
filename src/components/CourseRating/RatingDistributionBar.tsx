import type { CourseRatingAggregate } from '../../api/courseRatings';
import { useTranslation } from '../../hooks/useTranslation';

const EMOJIS = ['😫', '😕', '🙂', '🤩'];
const COLORS = ['bg-error/60', 'bg-warning/60', 'bg-info/60', 'bg-success/60'];

export function RatingDistributionBar({ aggregate }: { aggregate: CourseRatingAggregate }) {
    const { t } = useTranslation();
    const total = aggregate.totalCount;

    return (
        <div>
            <div className="flex items-end gap-0.5 h-6">
                {aggregate.distribution.map((count, i) => {
                    const pct = total > 0 ? (count / total) * 100 : 0;
                    if (pct === 0) return <div key={i} className="flex-none w-0" />;
                    return (
                        <div
                            key={i}
                            className={`${COLORS[i]} rounded-sm flex items-center justify-center h-full transition-all`}
                            style={{ width: `${pct}%`, minWidth: pct > 0 ? '20px' : 0 }}
                            title={`${EMOJIS[i]} ${count} (${Math.round(pct)}%)`}
                        >
                            <span className="text-[10px]">{EMOJIS[i]}</span>
                        </div>
                    );
                })}
            </div>
            <p className="text-[10px] text-base-content/40 mt-1">
                {t('courseRating.totalRatings', { count: total })}
            </p>
        </div>
    );
}
