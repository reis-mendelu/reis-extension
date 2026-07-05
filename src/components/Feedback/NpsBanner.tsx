import { useState } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';

const RATINGS = [1, 2, 3, 4, 5] as const;
const REASONS = ['missing_feature', 'bug', 'confusing', 'slow', 'other'] as const;
const STORE_URL = 'https://chromewebstore.google.com/detail/feildjaginpppijbpplcghalabdeibdb?utm_source=item-share-cb';

export function NpsBanner() {
    const { feedbackEligible, feedbackDismissed, submitNps, dismissFeedback } = useAppStore();
    const { t } = useTranslation();
    const [pendingRating, setPendingRating] = useState<number | null>(null);
    const [badRating, setBadRating] = useState<number | null>(null);
    const [copied, setCopied] = useState(false);

    if (!feedbackEligible || feedbackDismissed) return null;

    const handleRating = (rating: number) => {
        if (rating >= 4) {
            setPendingRating(rating);
        } else {
            setBadRating(rating);
        }
    };

    const handleReasonSelect = (reason: string) => {
        submitNps(badRating!, reason);
        toast.success(t('feedback.npsThank'));
    };

    const handleCopy = async () => {
        await navigator.clipboard.writeText(STORE_URL);
        setCopied(true);
        setTimeout(() => submitNps(pendingRating!), 2000);
    };

    const handleShareDismiss = () => {
        submitNps(pendingRating!);
    };

    if (pendingRating !== null) {
        return (
            <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2.5 mx-4 mt-3 flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-primary">{t('feedback.sharePrompt')}</span>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="btn btn-xs btn-primary no-animation"
                        onClick={handleCopy}
                    >
                        {copied ? t('feedback.shareCopied') : t('feedback.shareCopy')}
                    </button>
                    <button
                        type="button"
                        className="btn btn-xs btn-ghost opacity-50 hover:opacity-100 ml-1"
                        onClick={handleShareDismiss}
                        aria-label="Dismiss"
                    >
                        ✕
                    </button>
                </div>
            </div>
        );
    }

    if (badRating !== null) {
        return (
            <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2.5 mx-4 mt-3 flex items-center gap-2 flex-wrap">
                <span className="text-xs font-semibold text-primary">{t('feedback.reasonPrompt')}</span>
                <div className="flex items-center gap-1 flex-wrap">
                    {REASONS.map((reason) => (
                        <button
                            key={reason}
                            type="button"
                            className="btn btn-xs btn-ghost text-base-content/70 hover:text-primary hover:bg-primary/10"
                            onClick={() => handleReasonSelect(reason)}
                        >
                            {t(`feedback.reason.${reason}`)}
                        </button>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-primary/10 border border-primary/30 rounded-lg px-3 py-2.5 mx-4 mt-3 flex items-center justify-between gap-2">
            <span className="text-xs font-semibold text-primary">{t('feedback.npsQuestion')}</span>
            <div className="flex items-center gap-1">
                {RATINGS.map((rating) => (
                    <button
                        key={rating}
                        type="button"
                        className="btn btn-xs btn-ghost text-base-content/70 hover:text-primary hover:bg-primary/10"
                        onClick={() => handleRating(rating)}
                    >
                        {rating}
                    </button>
                ))}
                <button
                    type="button"
                    className="btn btn-xs btn-ghost opacity-50 hover:opacity-100 ml-1"
                    onClick={dismissFeedback}
                    aria-label="Dismiss"
                >
                    ✕
                </button>
            </div>
        </div>
    );
}
