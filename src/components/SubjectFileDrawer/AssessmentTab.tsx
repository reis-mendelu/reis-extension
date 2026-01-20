import { useMemo, useState, useEffect } from 'react';
import { ExternalLink, Trophy, Pencil, Check, X } from 'lucide-react';
import { useAssessments } from '../../hooks/data';
import { AssessmentSkeleton } from './AssessmentSkeleton';

interface AssessmentTabProps {
    courseCode: string;
}

export function AssessmentTab({ courseCode }: AssessmentTabProps) {
    const { assessments, isLoading } = useAssessments(courseCode);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editMax, setEditMax] = useState('');
    const [originalScore, setOriginalScore] = useState(0);
    const [originalMax, setOriginalMax] = useState(0);
    
    // Store adjustments: { assessmentName: { adjustedMax, adjustedScore } }
    const [adjustments, setAdjustments] = useState<Record<string, { adjustedMax: number; adjustedScore: number }>>({});
    
    // Store bonus points: { id: { name, points } }
    const [bonusPoints, setBonusPoints] = useState<Record<string, { name: string; points: number }>>({});

    // Load adjustments from localStorage on mount
    useEffect(() => {
        try {
            const savedAdj = localStorage.getItem(`assessment-adjustments-${courseCode}`);
            if (savedAdj) {
                setAdjustments(JSON.parse(savedAdj));
            }
            
            const savedBonus = localStorage.getItem(`bonus-points-${courseCode}`);
            if (savedBonus) {
                setBonusPoints(JSON.parse(savedBonus));
            }
        } catch (error) {
            console.error('[AssessmentTab] Failed to load data:', error);
        }
    }, [courseCode]);

    // Derived state for sorted assessments
    const sortedAssessments = useMemo(() => {
        if (!assessments) return [];

        // Sort by date descending (newest first)
        // Date format is "DD. MM. YYYY HH:mm"
        return [...assessments].sort((a, b) => {
            const parseDate = (d: string) => {
                const parts = d.split(/[. :]/).filter(Boolean);
                if (parts.length < 5) return 0;
                // new Date(year, monthIndex, day, hour, minute)
                return new Date(
                    parseInt(parts[2]), 
                    parseInt(parts[1]) - 1, 
                    parseInt(parts[0]), 
                    parseInt(parts[3]), 
                    parseInt(parts[4])
                ).getTime();
            };
            return parseDate(b.submittedDate) - parseDate(a.submittedDate);
        });
    }, [assessments]);

    // Helper to get adjusted or original values
    const getAssessmentValues = (test: typeof sortedAssessments[0]) => {
        const adjustment = adjustments[test.name];
        if (adjustment) {
            return {
                score: adjustment.adjustedScore,
                maxScore: adjustment.adjustedMax,
                isAdjusted: true
            };
        }
        return {
            score: test.score,
            maxScore: test.maxScore,
            isAdjusted: false
        };
    };

    // Calculate final grade
    const finalGrade = useMemo(() => {
        if (!sortedAssessments || sortedAssessments.length === 0) return null;
        
        let totalScore = 0;
        
        sortedAssessments.forEach(test => {
            // Inline adjustment lookup
            const adjustment = adjustments[test.name];
            if (adjustment) {
                totalScore += adjustment.adjustedScore;
            } else {
                totalScore += test.score;
            }
        });
        
        // Add bonus points
        Object.values(bonusPoints).forEach(bonus => {
            totalScore += bonus.points;
        });
        
        // Always calculated against 100 points
        const percentage = totalScore; 
        
        return {
            totalScore,
            totalMax: 100,
            percentage
        };
    }, [sortedAssessments, adjustments, bonusPoints]);

    const addBonusPoint = () => {
        const id = Date.now().toString();
        const newBonus = {
            ...bonusPoints,
            [id]: { name: 'Bonus', points: 0 }
        };
        setBonusPoints(newBonus);
        try {
            localStorage.setItem(`bonus-points-${courseCode}`, JSON.stringify(newBonus));
        } catch (error) {
            console.error('[AssessmentTab] Failed to save bonus:', error);
        }
    };

    const updateBonusPoint = (id: string, name: string, points: number) => {
        const newBonus = {
            ...bonusPoints,
            [id]: { name, points }
        };
        setBonusPoints(newBonus);
        try {
            localStorage.setItem(`bonus-points-${courseCode}`, JSON.stringify(newBonus));
        } catch (error) {
            console.error('[AssessmentTab] Failed to update bonus:', error);
        }
    };

    const removeBonusPoint = (id: string) => {
        const newBonus = { ...bonusPoints };
        delete newBonus[id];
        setBonusPoints(newBonus);
        try {
            localStorage.setItem(`bonus-points-${courseCode}`, JSON.stringify(newBonus));
        } catch (error) {
            console.error('[AssessmentTab] Failed to remove bonus:', error);
        }
    };

    // Show loading if hook says loading OR if assessments is null (initial state before sync)
    if (isLoading || assessments === null) {
        return <AssessmentSkeleton />;
    }

    if (assessments.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full p-6 text-center text-base-content/40">
                <Trophy className="w-12 h-12 opacity-20 mb-3" />
                <p className="text-sm">Zatím žádné hodnocení</p>
            </div>
        );
    }

    const startEditing = (index: number, score: number, maxScore: number) => {
        setEditingId(index);
        setOriginalScore(score);
        setOriginalMax(maxScore);
        setEditMax(maxScore.toString());
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditMax('');
        setOriginalScore(0);
        setOriginalMax(0);
    };

    const saveEdit = (index: number) => {
        const test = sortedAssessments[index];
        if (!test) return;

        const newMax = parseFloat(editMax);
        if (isNaN(newMax) || newMax < 0) {
            cancelEditing();
            return;
        }

        // Calculate new score proportionally
        const percentage = originalScore / originalMax;
        const newScore = percentage * newMax;

        // Save to state and localStorage
        const newAdjustments = {
            ...adjustments,
            [test.name]: { adjustedMax: newMax, adjustedScore: newScore }
        };
        setAdjustments(newAdjustments);
        
        try {
            localStorage.setItem(`assessment-adjustments-${courseCode}`, JSON.stringify(newAdjustments));
        } catch (error) {
            console.error('[AssessmentTab] Failed to save adjustments:', error);
        }

        cancelEditing();
    };

    return (
        <div className="flex flex-col h-full bg-base-100">
            {/* Assessment List */}
            <div className="flex-1 overflow-y-auto">
                <div className="divide-y divide-base-200">
                    {sortedAssessments.map((test, i) => {
                        const values = getAssessmentValues(test);
                        return (
                            <div 
                                key={i} 
                                className="px-4 py-3 hover:bg-base-200/30 transition-colors flex items-center gap-3"
                            >
                                {/* Test Name - Main column */}
                                <div className="flex-1 min-w-0">
                                    <div className="font-medium text-base-content truncate" title={test.name}>
                                        {test.name}
                                    </div>
                                    <div className="text-sm text-base-content/50 mt-0.5">
                                        {test.submittedDate}
                                        {test.teacher && <span className="ml-2">• {test.teacher}</span>}
                                    </div>
                                </div>

                                {/* Score - Editable */}
                                <div className="text-right flex-shrink-0 min-w-[140px] flex items-center gap-2 justify-end">
                                    {editingId === i ? (
                                        <div className="flex items-center gap-1.5">
                                            {/* Calculated score (read-only) */}
                                            <div className="font-mono text-sm text-base-content/70 min-w-[50px] text-right">
                                                {(() => {
                                                    const newMax = parseFloat(editMax);
                                                    if (isNaN(newMax) || newMax <= 0) {
                                                        return originalScore.toFixed(2).replace('.', ',');
                                                    }
                                                    const percentage = originalScore / originalMax;
                                                    const newScore = percentage * newMax;
                                                    return newScore.toFixed(2).replace('.', ',');
                                                })()}
                                            </div>
                                            <span className="text-base-content/60">/</span>
                                            {/* Editable max */}
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                className="input input-xs input-bordered w-16 text-right"
                                                value={editMax}
                                                onChange={e => setEditMax(e.target.value.replace(/[^0-9.]/g, ''))}
                                                autoFocus
                                                placeholder="Max"
                                            />
                                            <button
                                                onClick={() => saveEdit(i)}
                                                className="btn btn-ghost btn-xs text-success"
                                                title="Uložit"
                                            >
                                                <Check size={14} />
                                            </button>
                                            <button
                                                onClick={cancelEditing}
                                                className="btn btn-ghost btn-xs text-error"
                                                title="Zrušit"
                                            >
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <>
                                            <div className={`font-mono font-semibold ${values.isAdjusted ? 'text-success' : 'text-base-content'}`}>
                                                {values.score.toFixed(2).replace('.', ',')}
                                                <span className="text-base-content/40 text-sm font-normal"> / {values.maxScore}</span>
                                            </div>
                                            <button
                                                onClick={() => startEditing(i, test.score, test.maxScore)}
                                                className="btn btn-ghost btn-xs opacity-50 hover:opacity-100"
                                                title="Upravit maximum"
                                            >
                                                <Pencil size={14} />
                                            </button>
                                        </>
                                    )}
                                </div>

                                {/* Success Rate - Neutral Badge */}
                                <div className="flex-shrink-0 min-w-[50px] text-right">
                                    <span className="badge badge-sm badge-ghost opacity-70">
                                        {Math.round((values.score / values.maxScore) * 100)}%
                                    </span>
                                </div>

                                {/* Link - Highlighted in Green (Primary) */}
                                <div className="flex-shrink-0 w-8 text-right">
                                    {test.detailUrl ? (
                                        <a 
                                            href={`https://is.mendelu.cz/auth/student/list.pl${test.detailUrl}`}
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-primary hover:text-primary-focus transition-colors p-1 rounded hover:bg-primary/10 inline-block"
                                            title="Otevřít v IS"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            <ExternalLink size={16} />
                                        </a>
                                    ) : (
                                        <span className="text-base-content/10 p-1 inline-block">
                                            <ExternalLink size={16} />
                                        </span>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bonus Points Section */}
            {(Object.keys(bonusPoints).length > 0 || true) && (
                <div className="flex-shrink-0 border-t border-base-300 bg-base-100 p-3">
                    <div className="text-xs font-semibold text-base-content/60 mb-2">Bonusové body</div>
                    <div className="space-y-2">
                        {Object.entries(bonusPoints).map(([id, bonus]) => (
                            <div key={id} className="flex items-center gap-2">
                                <input
                                    type="text"
                                    className="input input-xs input-bordered flex-1"
                                    value={bonus.name}
                                    onChange={e => updateBonusPoint(id, e.target.value, bonus.points)}
                                    placeholder="Název"
                                />
                                <span className="text-base-content/60">:</span>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    className="input input-xs input-bordered w-16 text-right"
                                    value={bonus.points || ''}
                                    onChange={e => {
                                        const val = e.target.value.replace(/[^0-9.-]/g, '');
                                        updateBonusPoint(id, bonus.name, val ? parseFloat(val) : 0);
                                    }}
                                    placeholder="0"
                                />
                                <span className="text-xs text-base-content/60">bodů</span>
                                <button
                                    onClick={() => removeBonusPoint(id)}
                                    className="btn btn-ghost btn-xs text-error"
                                    title="Odstranit"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <button
                            onClick={addBonusPoint}
                            className="btn btn-ghost btn-xs w-full text-primary"
                        >
                            + Přidat bonus
                        </button>
                    </div>
                </div>
            )}

            {/* Final Grade Display */}
            {finalGrade && (
                <div className="flex-shrink-0 border-t border-base-300 bg-base-200/50 p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm text-base-content/60">Celkové hodnocení:</span>
                            <span className="text-2xl font-bold text-base-content">
                                {finalGrade.percentage.toFixed(1).replace('.', ',')}%
                            </span>
                            <span className="text-sm text-base-content/40">
                                ({finalGrade.totalScore.toFixed(1)} / {finalGrade.totalMax})
                            </span>
                        </div>
                    </div>
                    <div className="text-xs text-base-content/50 mt-1">
                        ⚠️ Toto hodnocení může být nepřesné - upravené váhy slouží pouze pro orientaci
                    </div>
                </div>
            )}
        </div>
    );
}
