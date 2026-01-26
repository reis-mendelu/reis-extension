interface FinalGradeDisplayProps {
    finalGrade: { totalScore: number; totalMax: number; percentage: number } | null;
}

export function FinalGradeDisplay({ finalGrade }: FinalGradeDisplayProps) {
    if (!finalGrade) return null;
    return (
        <div className="flex-shrink-0 border-t border-base-300 bg-base-200/50 p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-baseline gap-2">
                    <span className="text-sm text-base-content/60">Celkové hodnocení:</span>
                    <span className="text-2xl font-bold text-base-content">{finalGrade.percentage.toFixed(1).replace('.', ',')}%</span>
                    <span className="text-sm text-base-content/40">({finalGrade.totalScore.toFixed(1)} / {finalGrade.totalMax})</span>
                </div>
            </div>
            <div className="text-xs text-base-content/50 mt-1">⚠️ Toto hodnocení může být nepřesné - upravené váhy slouží pouze pro orientaci</div>
        </div>
    );
}
