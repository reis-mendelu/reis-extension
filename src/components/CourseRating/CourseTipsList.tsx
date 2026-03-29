import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { MessageCircle } from 'lucide-react';

export function CourseTipsList({ courseCode }: { courseCode: string }) {
    const { t } = useTranslation();
    const tips = useAppStore(s => s.courseTips[courseCode]);
    const myTip = useAppStore(s => s.myTips[courseCode]);

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
                    {otherTips.map((tip, i) => (
                        <li key={i}>
                            <span className="text-xs text-base-content/60">
                                &ldquo;{tip.tipText}&rdquo;
                            </span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
