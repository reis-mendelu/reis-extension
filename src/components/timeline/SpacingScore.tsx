
import { Frown, Meh, Smile, Laugh, TrendingUp } from 'lucide-react';

interface SpacingScoreProps {
    score: number;
}

export function SpacingScore({ score }: SpacingScoreProps) {
    const getScoreMessage = (s: number) => {
        if (s >= 90) return { text: 'Perfektní rozložení!', Icon: Laugh };
        if (s >= 70) return { text: 'Dobré rozložení', Icon: Smile };
        if (s >= 50) return { text: 'Některé zkoušky jsou blízko', Icon: Meh };
        return { text: 'Riziko přetížení', Icon: Frown };
    };

    const { text, Icon } = getScoreMessage(score);
    const scoreColor = score >= 70 ? 'success' : score >= 40 ? 'warning' : 'error';
    const textColor = score >= 70 ? 'text-success' : score >= 40 ? 'text-warning' : 'text-error';
    
    return (
        <div className="flex items-center gap-3 mb-3 pb-3 border-b border-base-300">
            <TrendingUp size={16} className="text-base-content/70" />
            <span className="text-sm font-medium text-base-content/70">Rozložení:</span>
            <progress
                className={`progress w-24 progress-${scoreColor}`}
                value={score}
                max={100}
            />
            <div className="flex items-center gap-1.5">
                <Icon size={14} className={textColor} />
                <span className="text-xs text-base-content/60">
                    {text}
                </span>
            </div>
        </div>
    );
}
