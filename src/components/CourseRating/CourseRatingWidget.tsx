import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { RatingDistributionBar } from './RatingDistributionBar';
import { ChevronRight, Send, Trash2 } from 'lucide-react';

const RATING_LABELS = ['label1', 'label2', 'label3', 'label4'] as const;
const MIN_RATINGS = 3;

export function CourseRatingWidget({ courseCode }: { courseCode: string }) {
    const { t } = useTranslation();
    const aggregate = useAppStore(s => s.courseRatingAggregates[courseCode]);
    const myRating = useAppStore(s => s.myRatings[courseCode]);
    const loading = useAppStore(s => s.ratingsLoading[courseCode]);
    const fetchCourseRating = useAppStore(s => s.fetchCourseRating);
    const submitRating = useAppStore(s => s.submitRating);

    const myTip = useAppStore(s => s.myTips[courseCode]);
    const fetchCourseTips = useAppStore(s => s.fetchCourseTips);
    const submitTip = useAppStore(s => s.submitTip);
    const deleteTip = useAppStore(s => s.deleteTip);

    const [tipOpen, setTipOpen] = useState(false);
    const [tipValue, setTipValue] = useState('');
    const [isEditing, setIsEditing] = useState(false);

    useEffect(() => {
        fetchCourseRating(courseCode);
        fetchCourseTips(courseCode);
    }, [courseCode, fetchCourseRating, fetchCourseTips]);

    useEffect(() => {
        if (myTip) setTipValue(myTip);
    }, [myTip]);

    if (loading && !aggregate) return null;

    const handleSubmitTip = () => {
        const trimmed = tipValue.trim();
        if (trimmed.length < 3 || trimmed.length > 140) return;
        submitTip(courseCode, trimmed);
        setTipOpen(false);
        setIsEditing(false);
    };

    const handleDeleteTip = () => {
        deleteTip(courseCode);
        setTipValue('');
        setTipOpen(false);
        setIsEditing(false);
    };

    // Compact mode: user already rated
    if (myRating) {
        return (
            <div className="card bg-base-100 rounded-none border-b border-base-300">
                <div className="card-body p-4 gap-3">
                    <div className="flex items-center gap-1">
                        {RATING_LABELS.map((key, i) => {
                            const value = i + 1;
                            return (
                                <button
                                    key={value}
                                    type="button"
                                    className={`btn btn-xs no-animation ${
                                        value === myRating
                                            ? 'btn-primary btn-active'
                                            : 'btn-ghost text-base-content/40'
                                    }`}
                                    onClick={() => submitRating(courseCode, value)}
                                >
                                    {t(`courseRating.${key}`)}
                                </button>
                            );
                        })}
                    </div>
                    {aggregate && aggregate.totalCount >= MIN_RATINGS && (
                        <RatingDistributionBar aggregate={aggregate} />
                    )}
                    <TipSection
                        myTip={myTip} tipOpen={tipOpen} isEditing={isEditing}
                        tipValue={tipValue} setTipValue={setTipValue}
                        setTipOpen={setTipOpen} setIsEditing={setIsEditing}
                        handleSubmitTip={handleSubmitTip} handleDeleteTip={handleDeleteTip}
                        t={t}
                    />
                </div>
            </div>
        );
    }

    // Expanded mode: not yet rated
    return (
        <div className="card card-compact bg-base-100 rounded-none border-b border-base-300">
            <div className="card-body">
                <h3 className="card-title text-xs text-base-content/70">{t('courseRating.question')}</h3>
                <div className="flex items-center gap-1">
                    {RATING_LABELS.map((key, i) => (
                        <button
                            key={i}
                            type="button"
                            className="btn btn-xs btn-ghost text-base-content/70 no-animation"
                            onClick={() => submitRating(courseCode, i + 1)}
                        >
                            {t(`courseRating.${key}`)}
                        </button>
                    ))}
                </div>
                <p className="text-xs text-base-content/40">{t('courseRating.beFirst')}</p>
            </div>
        </div>
    );
}

function TipSection({ myTip, tipOpen, isEditing, tipValue, setTipValue, setTipOpen, setIsEditing, handleSubmitTip, handleDeleteTip, t }: {
    myTip: string | undefined; tipOpen: boolean; isEditing: boolean;
    tipValue: string; setTipValue: (v: string) => void;
    setTipOpen: (v: boolean) => void; setIsEditing: (v: boolean) => void;
    handleSubmitTip: () => void; handleDeleteTip: () => void;
    t: (key: string) => string;
}) {
    if (tipOpen) {
        return (
            <div className="flex items-center gap-1.5">
                <input
                    type="text"
                    value={tipValue}
                    onChange={e => setTipValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleSubmitTip(); }}
                    placeholder={t('courseTips.placeholder')}
                    maxLength={140}
                    className="input input-xs input-bordered flex-1 focus:outline-none"
                    autoFocus
                />
                <button
                    type="button"
                    className="btn btn-xs btn-primary"
                    disabled={tipValue.trim().length < 3}
                    onClick={handleSubmitTip}
                >
                    <Send size={12} />
                </button>
            </div>
        );
    }

    if (myTip && !isEditing) {
        return (
            <div className="flex items-start gap-2">
                <p className="text-xs text-base-content/60 flex-1">
                    <span className="text-primary/60">{t('courseTips.myTip')}: </span>
                    &ldquo;{myTip}&rdquo;
                </p>
                <button
                    type="button"
                    className="btn btn-ghost btn-xs text-base-content/40"
                    onClick={() => { setTipOpen(true); setIsEditing(true); }}
                >
                    {t('courseTips.edit')}
                </button>
                <button
                    type="button"
                    className="btn btn-ghost btn-xs text-base-content/40"
                    onClick={handleDeleteTip}
                >
                    <Trash2 size={12} />
                </button>
            </div>
        );
    }

    return (
        <button
            type="button"
            className="btn btn-ghost btn-xs text-base-content/50 gap-1 -ml-1"
            onClick={() => setTipOpen(true)}
        >
            <ChevronRight size={12} />
            {t('courseTips.prompt')}
        </button>
    );
}
