import { ChevronLeft, ChevronRight } from 'lucide-react';

interface ModalFooterProps {
    curr: number;
    total: number;
    isFirst: boolean;
    isLast: boolean;
    onPrev: () => void;
    onNext: () => void;
    onGo: (idx: number) => void;
    onClose: () => void;
}

export function ModalFooter({ curr, total, isFirst, isLast, onPrev, onNext, onGo, onClose }: ModalFooterProps) {
    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-base-300 bg-base-100/80 backdrop-blur shrink-0">
            <button onClick={onPrev} disabled={isFirst} className="btn btn-ghost gap-2 opacity-30 disabled:opacity-30"><ChevronLeft size={20} /><span className="hidden sm:inline">Zpět</span></button>
            <div className="flex flex-col items-center gap-1.5">
                <div className="flex items-center gap-2">
                    {Array.from({ length: total }).map((_, i) => <button key={i} onClick={() => onGo(i)} className={`w-2 h-2 rounded-full transition-all ${i === curr ? 'bg-primary w-3' : 'bg-base-content/20 hover:bg-base-content/40'}`} aria-label={`Slide ${i + 1}`} />)}
                </div>
                <span className="text-xs font-medium text-base-content/50 uppercase tracking-wider">Slide {curr + 1} z {total}</span>
            </div>
            <button onClick={isLast ? onClose : onNext} className="btn btn-primary gap-2 min-w-[120px]"><span>{isLast ? 'Dokončit' : 'Další'}</span>{!isLast && <ChevronRight size={20} />}</button>
        </div>
    );
}
