import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { MessageCircle, ThumbsUp } from 'lucide-react';
import { relativeTime } from '../../utils/relativeTime';

export function CourseTipsList({ courseCode }: { courseCode: string }) {
    const { t } = useTranslation();
    const tips = useAppStore(s => s.courseTips[courseCode]);
    const myTip = useAppStore(s => s.myTips[courseCode]);
    const voteTipHelpful = useAppStore(s => s.voteTipHelpful);

    // Filter out user's own tip — it's already shown in the rating widget
    const otherTips = tips?.filter(tip => tip.tipText !== myTip) ?? [];

    if (otherTips.length === 0) return null;

    return (
        <div className="card card-compact bg-base-100 rounded-none border-b border-base-300">
            <div className="card-body gap-1.5">
                <div className="flex items-center gap-1.5">
                    <MessageCircle size={12} className="text-primary/60" />
                    <h3 className="card-title text-xs text-base-content/70">
                        {t('courseTips.listTitle')} ({otherTips.length})
                    </h3>
                </div>
                <ul className="menu menu-xs p-0 gap-0">
                    {otherTips.map((tip) => (
                        <li key={tip.tipId}>
                            <div className="flex items-center gap-2 w-full">
                                <span className="text-xs text-base-content/60 flex-1">
                                    &ldquo;{tip.tipText}&rdquo;
                                </span>
                                <span className="text-[10px] text-base-content/30">
                                    {relativeTime(tip.createdAt, t)}
                                </span>
                                <button
                                    type="button"
                                    className={`btn btn-xs no-animation gap-0.5 ${
                                        tip.votedByMe
                                            ? 'btn-primary btn-sm'
                                            : 'btn-ghost text-base-content/30'
                                    }`}
                                    onClick={(e) => { e.stopPropagation(); voteTipHelpful(courseCode, tip.tipId); }}
                                >
                                    <ThumbsUp size={10} />
                                    {tip.helpfulCount > 0 && (
                                        <span className="text-[10px]">{tip.helpfulCount}</span>
                                    )}
                                </button>
                            </div>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
