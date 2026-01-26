import { Timer } from 'lucide-react';

export function TermsSummary({ terms }: any) {
    const opening = terms.find((t: any) => t.canRegisterNow !== true && t.registrationStart);
    return (
        <div className="flex flex-col gap-2 mt-2.5">
            <div className="flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold text-base-content/40 tracking-wider whitespace-nowrap">{terms.length} termín{terms.length > 1 ? (terms.length < 5 ? 'y' : 'ů') : ''}</span>
                <div className="flex items-center gap-1.5 overflow-hidden">
                    {terms.slice(0, 3).map((t: any) => <div key={t.id} className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${t.full || (t.capacity && t.capacity.occupied >= t.capacity.total) ? 'bg-base-200 text-base-content/30' : 'bg-primary/5 text-primary/70'}`}>{t.date.split('.').slice(0, 2).join('.')}</div>)}
                    {terms.length > 3 && <span className="text-[10px] font-bold text-base-content/30">+{terms.length - 3}</span>}
                </div>
            </div>
            {opening && <div className="flex items-center gap-1.5 text-[10px] font-bold text-warning/80"><Timer size={12} className="text-warning/60" /><span className="uppercase tracking-tight">Otevírá se: {opening.registrationStart}</span></div>}
        </div>
    );
}
