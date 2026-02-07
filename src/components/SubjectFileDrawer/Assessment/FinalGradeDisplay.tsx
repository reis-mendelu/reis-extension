import { useTranslation } from '../../../hooks/useTranslation';

interface FinalGradeDisplayProps {
    finalGrade: { totalScore: number; totalMax: number; percentage: number } | null;
}

export function FinalGradeDisplay({ finalGrade }: FinalGradeDisplayProps) {
    const { t, language } = useTranslation();
    if (!finalGrade) return null;
    return (
        <div className="flex-shrink-0 border-t border-base-300 bg-base-200/50 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm text-base-content/60">{t('assessment.finalTitle')}</span>
                    <span className="text-2xl font-bold text-base-content">{language === 'cs' ? finalGrade.percentage.toFixed(1).replace('.', ',') : finalGrade.percentage.toFixed(1)}%</span>
                    <span className="text-sm text-base-content/40">({language === 'cs' ? finalGrade.totalScore.toFixed(1).replace('.', ',') : finalGrade.totalScore.toFixed(1)} / {finalGrade.totalMax})</span>
                </div>
            </div>
            <div className="text-xs text-base-content/50 mt-1">{t('assessment.warning')}</div>
        </div>
    );
}
