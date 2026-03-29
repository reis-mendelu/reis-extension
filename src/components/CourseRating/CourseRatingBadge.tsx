import type { CourseRatingAggregate } from '../../api/courseRatings';

const EMOJIS = ['😫', '😕', '🙂', '🤩'];
const MIN_RATINGS = 3;

export function CourseRatingBadge({ aggregate }: { aggregate?: CourseRatingAggregate }) {
    if (!aggregate || aggregate.totalCount < MIN_RATINGS) return null;

    const dominantIndex = aggregate.distribution.reduce(
        (maxI, count, i, arr) => (count > arr[maxI] ? i : maxI), 0
    );

    return (
        <span
            className="flex items-center gap-0.5 h-5 px-1.5 rounded text-[10px] font-medium bg-base-content/5 text-base-content/50 shrink-0"
            title={`${aggregate.avgRating}/4`}
        >
            <span>{EMOJIS[dominantIndex]}</span>
            <span>{aggregate.totalCount}</span>
        </span>
    );
}
