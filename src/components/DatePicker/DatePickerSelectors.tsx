import type { ExamTerm } from '../../types/exams';

interface DatePickerSelectorsProps {
    selectedDate: string | null;
    termsForDate: ExamTerm[];
    selectedTermId: string | null;
    onSelectTerm: (id: string | null) => void;
    onConfirm: (id: string) => void;
}

export function DatePickerSelectors({ selectedDate, termsForDate, selectedTermId, onSelectTerm, onConfirm }: DatePickerSelectorsProps) {
    if (!selectedDate) return null;
    return (
        <>
            <div className="px-3 pb-2 border-t border-slate-200 pt-2 bg-white">
                <div className="text-[10px] font-medium text-slate-500 mb-1.5">Vyber čas:</div>
                <div className="flex flex-wrap gap-1.5">
                    {termsForDate.map((t) => (
                        <button key={t.id} onClick={() => onSelectTerm(t.id)} disabled={t.full}
                                className={`btn btn-xs font-medium h-auto py-1 px-2 min-h-0 ${t.full ? 'bg-slate-100 text-slate-300' : selectedTermId === t.id ? 'btn-primary text-white' : 'btn-ghost bg-white text-slate-700 border-slate-200 hover:bg-slate-100'}`}>
                            {t.time}{t.capacity && <span className="ml-0.5 opacity-60">({String(t.capacity)})</span>}
                        </button>
                    ))}
                </div>
            </div>
            {selectedTermId && <div className="px-3 pb-3 bg-white"><button onClick={() => onConfirm(selectedTermId)} className="btn btn-primary btn-sm w-full">Potvrdit</button></div>}
        </>
    );
}
