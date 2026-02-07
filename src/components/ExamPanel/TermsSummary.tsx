import { useTranslation } from '../../hooks/useTranslation';

export function TermsSummary({ terms }: any) {
    const { t } = useTranslation();
    const count = terms.length;
    const label = count === 1 ? t('exams.term') : count > 1 && count < 5 ? t('exams.terms24') : t('exams.terms5plus');
    
    return (
        <div className="flex flex-col gap-2 mt-2.5">
            <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider whitespace-nowrap">{count} {label}</span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {terms.slice(0, 3).map((t: any) => <div key={t.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.full || (t.capacity && t.capacity.occupied >= t.capacity.total) ? 'bg-base-200 text-base-content/30' : 'bg-primary/5 text-primary/70'}`}>{t.date.split('.').slice(0, 2).join('.')}</div>)}
                    {terms.length > 3 && <span className="text-[10px] font-bold text-base-content/30">+{terms.length - 3}</span>}
                </div>
            </div>
        </div>
    );
}
