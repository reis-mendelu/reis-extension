import { useState } from 'react';
import { useSuccessRate } from '../hooks/data/useSuccessRate';
import { AlertTriangle, ExternalLink } from 'lucide-react';
import { sortSemesters } from '../utils/semesterSort';
import { GradeBarChart } from './SuccessRate/GradeBarChart';
import { SemesterSelector } from './SuccessRate/SemesterSelector';
import { useTranslation } from '../hooks/useTranslation';

const COLORS: Record<string, string> = { A: 'var(--color-grade-a)', B: 'var(--color-grade-b)', C: 'var(--color-grade-c)', D: 'var(--color-grade-d)', E: 'var(--color-grade-e)', F: 'var(--color-grade-f)', FN: 'var(--color-grade-fn)' };

export function SuccessRateTab({ courseCode, facultyCode }: { courseCode: string; facultyCode?: string }) {
    const { stats: data, loading } = useSuccessRate(courseCode);
    const [idx, setIdx] = useState(0);
    const { t } = useTranslation();

    if (loading) return <div className="flex items-center justify-center h-full"><span className="loading loading-spinner text-primary" /></div>;
    if (!data?.stats?.length) return <div className="flex flex-col items-center justify-center h-full"><AlertTriangle className="w-8 h-8 opacity-40 mb-3" /><p className="text-sm opacity-60">{t('successRate.noData')}</p></div>;

    const allStats = sortSemesters(data.stats);
    const filtered = facultyCode ? allStats.filter(s => s.semesterName.split(' - ').at(-1) === facultyCode) : allStats;
    const stats = (filtered.length > 0 ? filtered : allStats).slice(0, 5), sIdx = Math.min(idx, stats.length - 1), current = stats[sIdx];
    const isCredit = current.type === 'credit', total = current.totalPass + current.totalFail;
    const order = isCredit ? ['zap', 'nezap'] : ['A', 'B', 'C', 'D', 'E', 'F', 'FN'];
    const colors = isCredit ? { zap: 'var(--color-success)', nezap: 'var(--color-error)' } : COLORS;

    const grades = current.terms.reduce((acc: Record<string, number>, tRes) => {
        if (isCredit && tRes.creditGrades) { 
            acc.zap = (acc.zap || 0) + (tRes.creditGrades.zap || 0); 
            acc.nezap = (acc.nezap || 0) + (tRes.creditGrades.nezap || 0) + (tRes.creditGrades.zapNedost || 0); 
        } else if (tRes.grades) {
            Object.entries(tRes.grades).forEach(([g, c]) => acc[g] = (acc[g] || 0) + c);
        }
        return acc;
    }, {});

    const max = Math.max(...order.map(g => grades[g] || 0), 1);

    return (
        <div className="flex flex-col h-full px-4 py-3 select-none font-inter">
            <div className="text-center mb-6 flex items-center justify-center gap-2">
                <span className="text-sm opacity-50 font-bold uppercase tracking-wider">{total} {t('successRate.students')} {isCredit ? ` (${t('successRate.credit')})` : ` (${t('successRate.exam')})`}</span>
                {current.sourceUrl && <a href={current.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-primary/50 hover:text-primary"><ExternalLink size={16} /></a>}
            </div>
            <GradeBarChart grades={grades} order={order} colors={colors} max={max} />
            <SemesterSelector stats={stats} activeIndex={sIdx} onSelect={setIdx} />
        </div>
    );
}
