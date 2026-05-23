import { X } from 'lucide-react';
import { Accordion } from './ui/accordion';
import { useEffect } from 'react';
import { DatePickerPopup } from './DatePickerPopup';
import { useExamDrawerLogic } from '../hooks/useExamDrawerLogic';
import { ExamSubjectItem } from './Exams/ExamSubjectItem';
import { AdaptiveDrawer } from './ui/AdaptiveDrawer';

export function ExamDrawer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
    const { 
        exams, isLoading, error, expandedSubjectId, setExpandedSubjectId, 
        popupSection, setPopupSection, popupAnchorRef, setPopupAnchor, 
        processingId, autoBookingId, handleRegister 
    } = useExamDrawerLogic(isOpen);
    
    useEffect(() => {
        if (!isOpen) return;
        const esc = (e: KeyboardEvent) => e.key === 'Escape' && (popupSection ? setPopupSection(null) : onClose());
        document.addEventListener('keydown', esc);
        return () => document.removeEventListener('keydown', esc);
    }, [isOpen, onClose, popupSection, setPopupSection]);

    return (
        <>
            <AdaptiveDrawer open={isOpen} onClose={onClose}>
                <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-5 bg-white border-b border-slate-100">
                    <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Zkoušky</h2>
                    <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm -mr-2 text-slate-400 hover:text-slate-600"><X size={20} /></button>
                </div>
                {autoBookingId && <div className="bg-amber-50 border-b border-amber-100 px-6 py-3 flex items-center gap-3"><div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" /><span className="text-sm text-amber-800 font-medium">Auto-rezervace aktivní. Nezavírejte tuto záložku!</span></div>}
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? <div className="flex items-center justify-center h-full text-slate-400">Načítání zkoušek...</div> :
                     error ? <div className="flex items-center justify-center h-full text-error">{error}</div> :
                     <Accordion type="single" collapsible value={expandedSubjectId} onValueChange={setExpandedSubjectId}>
                        {exams.map(sub => <ExamSubjectItem key={sub.id} subject={sub} processingId={processingId} onOpenPicker={(sec, b) => { setPopupSection(sec); setPopupAnchor(b); }} />)}
                     </Accordion>
                    }
                </div>
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-center"><a href="https://is.mendelu.cz/auth/student/terminy_seznam.pl?lang=cz" target="_blank" rel="noopener noreferrer" className="text-xs text-slate-400 hover:text-slate-600 flex items-center gap-1">Přejít na stránku zkoušek v IS <X size={10} /></a></div>
            </AdaptiveDrawer>
            <DatePickerPopup isOpen={!!popupSection} onClose={() => setPopupSection(null)} onConfirm={(tid: string) => popupSection && handleRegister(popupSection, tid)} terms={popupSection?.terms ?? []} anchorRef={popupAnchorRef} allExams={exams} />
        </>
    );
}
