
import { Frown, Meh, Smile, Laugh } from 'lucide-react';

interface TimelineGapProps {
    days: number;
    nextExamRate?: number;
}

export function TimelineGap({ days, nextExamRate }: TimelineGapProps) {
    // Contextual Risk Intelligence logic
    const getGapInfo = (days: number, nextExamSuccessRate?: number) => {
        if (days <= 2 && nextExamSuccessRate !== undefined && nextExamSuccessRate < 0.6) {
            const ratePercent = Math.round(nextExamSuccessRate * 100);
            return {
                Icon: Frown, // Downgraded from TriangleAlert to avoid "double warning" icons
                color: 'text-error',
                tooltip: `Vysoké riziko: Následující zkouška má úspěšnost jen ${ratePercent}%. ${days} den na přípravu je kriticky málo.`,
                isRisk: true
            };
        }
        if (days <= 1) return { Icon: Frown, color: 'text-error', tooltip: 'Vysoké riziko - malý čas na přípravu', isRisk: false };
        if (days <= 3) return { Icon: Meh, color: 'text-warning', tooltip: 'Těsné, ale zvládnutelné', isRisk: false };
        if (days <= 6) return { Icon: Smile, color: 'text-success', tooltip: 'Zdravé rozložení', isRisk: false };
        return { Icon: Laugh, color: 'text-success', tooltip: 'Optimální pro zapamatování!', isRisk: false };
    };

    const { Icon, color, tooltip, isRisk } = getGapInfo(days, nextExamRate);
    const borderColor = (isRisk || days <= 1) ? 'bg-error' : 'bg-base-300';
    const textColor = (isRisk || days <= 1) ? 'text-error font-medium' : 'text-base-content/30';

    return (
        <li>
            <hr className={borderColor} />
            <div className="timeline-middle tooltip tooltip-bottom" data-tip={tooltip}>
                <div className="flex flex-col items-center">
                    <Icon
                        size={12}
                        className={color}
                    />
                    <span className={`text-2xs ${textColor}`}>
                        {days}d
                    </span>
                </div>
            </div>
            <hr className={borderColor} />
        </li>
    );
}
