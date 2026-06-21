import type { ExamTerm } from '../../types/exams';
import { useTranslation } from '../../hooks/useTranslation';

interface DatePickerSelectorsProps {
    selectedDate: string | null;
    termsForDate: ExamTerm[];
    selectedTermId: string | null;
    onSelectTerm: (id: string | null) => void;
    onConfirm: (id: string) => void;
}

export function DatePickerSelectors({ selectedDate, termsForDate, selectedTermId, onSelectTerm, onConfirm }: DatePickerSelectorsProps) {
    const { t: tr } = useTranslation();
    if (!selectedDate) return null;
    return (
        <>
            <div className="px-3 pb-2 border-t border-base-300 pt-2 bg-base-100">
                <div className="text-[10px] font-medium text-base-content/60 mb-1.5">{tr('calendar.pickTime')}</div>
                <div className="flex flex-wrap gap-1.5">
                    {termsForDate.map((t) => (
                        <button key={t.id} onClick={() => onSelectTerm(t.id)} disabled={t.full}
                                className={`btn btn-xs font-medium h-auto py-1 px-2 min-h-0 ${t.full ? 'bg-base-200 text-base-content/40' : selectedTermId === t.id ? 'btn-primary' : 'btn-ghost bg-base-100 text-base-content border-base-300 hover:bg-base-200'}`}>
                            {t.time}{t.capacity && <span className="ml-0.5 opacity-60">({String(t.capacity)})</span>}
                        </button>
                    ))}
                </div>
            </div>
            {selectedTermId && <div className="px-3 pb-3 bg-base-100"><button onClick={() => onConfirm(selectedTermId)} className="btn btn-primary btn-sm w-full">Potvrdit</button></div>}
        </>
    );
}
