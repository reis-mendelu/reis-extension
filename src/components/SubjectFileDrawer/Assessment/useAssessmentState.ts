import { useMemo, useState, useEffect } from 'react';
import { useAssessments, useSyncStatus } from '../../../hooks/data';
import { IndexedDBService } from '../../../services/storage';

export function useAssessmentState(courseCode: string) {
    const { assessments, isLoading } = useAssessments(courseCode);
    const { isSyncing } = useSyncStatus();
    const [editingId, setEditingId] = useState<number | null>(null);
    const [editMax, setEditMax] = useState('');
    const [originalScore, setOriginalScore] = useState(0);
    const [originalMax, setOriginalMax] = useState(0);
    const [adjustments, setAdjustments] = useState<Record<string, { adjustedMax: number; adjustedScore: number }>>({});
    const [bonusPoints, setBonusPoints] = useState<Record<string, { name: string; points: number }>>({});

    useEffect(() => {
        const load = async () => {
            const [a, b] = await Promise.all([
                IndexedDBService.get('meta', `assessment_adjustments_${courseCode}`),
                IndexedDBService.get('meta', `bonus_points_${courseCode}`)
            ]);
            if (a) setAdjustments(a);
            if (b) setBonusPoints(b);
        };
        load();
    }, [courseCode]);

    const sortedAssessments = useMemo(() => {
        if (!assessments) return [];
        return [...assessments].sort((a, b) => {
            const parse = (d: string) => {
                const p = d.split(/[. :]/).filter(Boolean);
                return p.length < 5 ? 0 : new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]), Number(p[3]), Number(p[4])).getTime();
            };
            return parse(b.submittedDate) - parse(a.submittedDate);
        });
    }, [assessments]);

    const finalGrade = useMemo(() => {
        if (!sortedAssessments.length) return null;
        let total = 0;
        sortedAssessments.forEach(t => total += adjustments[t.name]?.adjustedScore ?? t.score);
        Object.values(bonusPoints).forEach(b => total += b.points);
        return { totalScore: total, totalMax: 100, percentage: total };
    }, [sortedAssessments, adjustments, bonusPoints]);

    return { assessments, sortedAssessments, isLoading, isSyncing, editingId, setEditingId, editMax, setEditMax, originalScore, setOriginalScore, originalMax, setOriginalMax, adjustments, setAdjustments, bonusPoints, setBonusPoints, finalGrade };
}
