import type { TermStats } from '../../types/documents';
import { useTranslation } from '../../hooks/useTranslation';

const TERM_ORDER = ['Řádný termín', '1. opravný', '2. opravný'];
const TERM_KEYS: Record<string, string> = {
    'Řádný termín': 'successRate.regular',
    '1. opravný': 'successRate.retake1',
    '2. opravný': 'successRate.retake2',
    'Všechny termíny': 'successRate.allTerms',
};

interface TermBreakdownProps {
    terms: TermStats[];
    isCredit: boolean;
}

function getSegments(term: TermStats, isCredit: boolean) {
    if (isCredit && term.creditGrades) {
        const { zap, nezap, zapNedost } = term.creditGrades;
        return [
            { key: 'zap', count: zap, color: 'var(--color-success)' },
            { key: 'nezap', count: nezap + (zapNedost || 0), color: 'var(--color-error)' },
        ].filter(s => s.count > 0);
    }
    return [
        { key: 'pass', count: term.pass, color: 'var(--color-success)' },
        { key: 'fail', count: term.fail, color: 'var(--color-error)' },
    ].filter(s => s.count > 0);
}

export function TermBreakdown({ terms, isCredit }: TermBreakdownProps) {
    const { t } = useTranslation();
    const sorted = [...terms].sort((a, b) =>
        (TERM_ORDER.indexOf(a.term) >>> 0) - (TERM_ORDER.indexOf(b.term) >>> 0)
    );

    return (
        <div className="flex flex-col gap-1.5 mb-4 px-1">
            {sorted.map(term => {
                const total = term.pass + term.fail;
                if (total === 0) return null;
                const rate = Math.round((term.pass / total) * 100);
                const label = TERM_KEYS[term.term] ? t(TERM_KEYS[term.term]) : term.term;
                const segments = getSegments(term, isCredit);

                return (
                    <div key={term.term} className="flex items-center gap-3">
                        <span className="text-2xs font-semibold text-base-content/60 w-20 text-right shrink-0">{label}</span>
                        <div className="flex-1 h-2 bg-base-content/8 rounded-full overflow-hidden flex opacity-85">
                            {segments.map(seg => (
                                <div
                                    key={seg.key}
                                    className="h-full transition-all duration-300"
                                    style={{
                                        width: `${(seg.count / total) * 100}%`,
                                        backgroundColor: seg.color,
                                    }}
                                />
                            ))}
                        </div>
                        <span className="text-2xs font-bold text-base-content/70 w-16 shrink-0">
                            {rate}% <span className="font-normal text-base-content/40">({total})</span>
                        </span>
                    </div>
                );
            })}
        </div>
    );
}
