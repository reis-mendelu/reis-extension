import { X } from 'lucide-react';
import { Accordion } from './ui/accordion';
import { useEffect } from 'react';
import { DatePickerPopup } from './DatePickerPopup';
import { useExamDrawerLogic } from '../hooks/useExamDrawerLogic';
import { ExamSubjectItem } from './Exams/ExamSubjectItem';

export function ExamDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const s = useExamDrawerLogic(isOpen, onClose);
    
    useEffect(() => {
        if (!isOpen) return;
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && (s.popupSection ? s.setPopupSection(null) : onClose());
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [isOpen, onClose, s.popupSection]);

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 z-50 flex justify-end items-stretch p-4 isolate">
                <div className="absolute inset-0 bg-black/15 transition-opacity" onClick={onClose} />
                <div className="w-full flex justify-end items-start h-full pt-10 pb-10 relative z-10 pointer-events-none">
                    <div className="w-[600px] bg-white shadow-2xl rounded-2xl flex flex-col overflow-hidden border border-gray-100 h-full animate-in slide-in-from-right duration-300 pointer-events-auto">
                        <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
                            <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Zkoušky</h2>
                            <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm -mr-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                        </div>
                        {s.autoBookingId && <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /><span className="text-sm text-amber-800 font-medium">Auto-rezervace aktivní. Nezavírejte tuto záložku!</span></div>}
                        <div className="flex-1 overflow-y-auto">
                            {s.isLoading ? <div className="flex items-center justify-center h-full text-slate-400">Načítání zkoušek...</div> :
                             s.error ? <div className="flex items-center justify-center h-full text-error">{s.error}</div> :
                             <Accordion type="single" collapsible value={s.expandedSubjectId} onValueChange={s.setExpandedSubjectId}>
                                {s.exams.map(sub => <ExamSubjectItem key={sub.id} subject={sub} processingId={s.processingId} onOpenPicker={(sec: any, b: any) => { s.setPopupSection(sec); s.setPopupAnchor(b); }} />)}
                             </Accordion>
                            }
                        </div>
                        <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center"><a href="https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">Přejít na stránku zkoušek v IS <X size={10} /></a></div>
                    </div>
                </div>
            </div>
            <DatePickerPopup isOpen={!!s.popupSection} onClose={() => s.setPopupSection(null)} onConfirm={(tid: string) => s.popupSection && s.handleRegister(s.popupSection, tid)} terms={s.popupSection?.terms ?? []} anchorRef={s.popupAnchorRef} allExams={s.exams} />
        </>
    );
}
