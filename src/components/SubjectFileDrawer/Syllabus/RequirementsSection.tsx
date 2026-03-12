import { Info } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

export function RequirementsSection({ text }: { text: string }) {
    const { t } = useTranslation();
    const highlight = (tStr: string) => tStr.split(/((?:min\.|max\.)?\s*\d+(?:[.,]\d+)?\s*(?:bodů|bodu|body|b\.|%)|(?:A|B|C|D|E|F)\s*\([^)]+\)|Zkouška|Zápočet)/g).map((p, i) => {
        if (p.match(/(?:min\.|max\.)?\s*\d+(?:[.,]\d+)?\s*(?:bodů|bodu|body|b\.|%)/)) return <span key={i} className="font-bold text-primary">{p}</span>;
        if (p.match(/^(?:A|B|C|D|E|F)\s*\([^)]+\)/)) return <span key={i} className="font-bold text-base-content">{p}</span>;
        if (p === 'Zkouška' || p === 'Zápočet') return <span key={i} className="font-semibold underline decoration-primary/30 decoration-2 underline-offset-2">{p === 'Zkouška' ? t('successRate.exam') : t('successRate.credit')}</span>;
        return p;
    });

    return (
        <div className="prose prose-sm max-w-none">
            <h3 className="text-[14px] font-bold mb-2 flex items-center gap-2"><Info size={16} className="text-primary" /> {t('syllabus.conditions')}</h3>
            <div className="bg-base-200/20 rounded-xl p-3 sm:p-4 border border-base-200">
                {text.split('\n').filter(l => l.trim()).map((l, i) => {
                    const trimmed = l.trim();
                    if (trimmed.startsWith('-') || trimmed.startsWith('•')) return <div key={i} className="flex gap-2 ml-1 mb-1"><div className="w-1 h-1 rounded-full bg-primary mt-2 shrink-0" /><span className="opacity-80 leading-snug text-xs sm:text-[13px]">{highlight(trimmed.substring(1).trim())}</span></div>;
                    if (trimmed.match(/^[A-F] \(/)) return <div key={i} className="flex flex-wrap gap-1.5 my-1.5">{trimmed.split(/, ?(?=[A-F] \()/).map((g, gi) => <span key={gi} className="badge badge-soft py-2 h-auto text-[10px]">{g.trim()}</span>)}</div>;
                    if (trimmed.length < 50 && trimmed.endsWith(':')) return <h4 key={i} className="font-bold mt-2 mb-1 text-xs">{trimmed}</h4>;
                    return <p key={i} className="mb-1.5 opacity-80 leading-snug last:mb-0 text-xs sm:text-[13px]">{highlight(trimmed)}</p>;
                })}
            </div>
        </div>
    );
}
