import { Trophy } from 'lucide-react';
import { IndexedDBService } from '../../services/storage';
import { AssessmentSkeleton } from './AssessmentSkeleton';
import { useAssessmentState } from './Assessment/useAssessmentState';
import { AssessmentItem } from './Assessment/AssessmentItem';
import { BonusPointsSection } from './Assessment/BonusPointsSection';
import { FinalGradeDisplay } from './Assessment/FinalGradeDisplay';

export function AssessmentTab({ courseCode }: { courseCode: string }) {
    const s = useAssessmentState(courseCode);
    if (s.isLoading || (s.isSyncing && s.assessments === null)) return <AssessmentSkeleton />;
    if (s.assessments === null || s.assessments.length === 0) return (
        <div className="flex flex-col items-center justify-center h-full p-6 text-center text-base-content/40">
            <Trophy className="w-12 h-12 opacity-20 mb-3" /><p className="text-sm">Zatím žádné hodnocení</p>
        </div>
    );

    const saveAdj = (adj: any) => IndexedDBService.set('meta', `assessment_adjustments_${courseCode}`, adj).catch(e => console.error(e));
    const saveBonus = (b: any) => IndexedDBService.set('meta', `bonus_points_${courseCode}`, b).catch(e => console.error(e));

    return (
        <div className="flex flex-col h-full bg-base-100">
            <div className="flex-1 overflow-y-auto divide-y divide-base-200">
                {s.sortedAssessments.map((test, i) => {
                    const adj = s.adjustments[test.name];
                    const values = adj ? { score: adj.adjustedScore, maxScore: adj.adjustedMax, isAdjusted: true } : { score: test.score, maxScore: test.maxScore, isAdjusted: false };
                    return (
                        <AssessmentItem key={i} index={i} test={test} isEditing={s.editingId === i} editMax={s.editMax}
                            onStartEdit={() => { s.setEditingId(i); s.setOriginalScore(test.score); s.setOriginalMax(test.maxScore); s.setEditMax(test.maxScore.toString()); }}
                            onCancelEdit={() => s.setEditingId(null)} onEditMaxChange={s.setEditMax} values={values}
                            onSaveEdit={() => {
                                const newMax = parseFloat(s.editMax);
                                if (!isNaN(newMax)) {
                                    const newAdj = { ...s.adjustments, [test.name]: { adjustedMax: newMax, adjustedScore: (s.originalScore / s.originalMax) * newMax } };
                                    s.setAdjustments(newAdj); saveAdj(newAdj);
                                }
                                s.setEditingId(null);
                            }} />
                    );
                })}
            </div>
            <BonusPointsSection bonusPoints={s.bonusPoints} onAdd={() => { const id = Date.now().toString(); const nb = { ...s.bonusPoints, [id]: { name: 'Bonus', points: 0 } }; s.setBonusPoints(nb); saveBonus(nb); }}
                onRemove={id => { const nb = { ...s.bonusPoints }; delete nb[id]; s.setBonusPoints(nb); saveBonus(nb); }}
                onUpdate={(id, name, points) => { const nb = { ...s.bonusPoints, [id]: { name, points } }; s.setBonusPoints(nb); saveBonus(nb); }} />
            <FinalGradeDisplay finalGrade={s.finalGrade} />
        </div>
    );
}
