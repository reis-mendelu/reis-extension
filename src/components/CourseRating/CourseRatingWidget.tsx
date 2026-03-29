import { useEffect } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { RatingDistributionBar } from './RatingDistributionBar';

const RATING_LABELS = ['label1', 'label2', 'label3', 'label4'] as const;
const MIN_RATINGS = 3;

export function CourseRatingWidget({ courseCode }: { courseCode: string }) {
    const { t } = useTranslation();
    const aggregate = useAppStore(s => s.courseRatingAggregates[courseCode]);
    const myRating = useAppStore(s => s.myRatings[courseCode]);
    const loading = useAppStore(s => s.ratingsLoading[courseCode]);
    const fetchCourseRating = useAppStore(s => s.fetchCourseRating);
    const submitRating = useAppStore(s => s.submitRating);

    useEffect(() => {
        fetchCourseRating(courseCode);
    }, [courseCode, fetchCourseRating]);

    if (loading && !aggregate) return null;

    return (
        <div className="px-4 py-3 border-b border-base-300 bg-base-100">
            <p className="text-xs font-semibold text-base-content/70 mb-2">{t('courseRating.question')}</p>
            <div className="flex items-center gap-1">
                {RATING_LABELS.map((key, i) => {
                    const value = i + 1;
                    const isSelected = myRating === value;
                    return (
                        <button
                            key={value}
                            type="button"
                            className={`btn btn-xs no-animation transition-all ${
                                isSelected
                                    ? 'btn-primary ring-2 ring-primary/30 scale-105'
                                    : 'btn-ghost text-base-content/70 hover:text-primary hover:bg-primary/10'
                            }`}
                            onClick={() => submitRating(courseCode, value)}
                        >
                            {t(`courseRating.${key}`)}
                        </button>
                    );
                })}
            </div>
            <div className="mt-2">
                {aggregate && aggregate.totalCount >= MIN_RATINGS ? (
                    <RatingDistributionBar aggregate={aggregate} />
                ) : myRating ? (
                    <p className="text-xs text-success/70">{t('courseRating.thanks')}</p>
                ) : (
                    <p className="text-xs text-base-content/40">{t('courseRating.beFirst')}</p>
                )}
            </div>
        </div>
    );
}
