import { motion, AnimatePresence } from 'motion/react';
import { Calendar, Info } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from '../../../hooks/useTranslation';

interface OutlookSyncToggleProps {
    enabled: boolean | null;
    loading: boolean;
    onToggle: () => void;
}

export function OutlookSyncToggle({ enabled, loading, onToggle }: OutlookSyncToggleProps) {
    const [show, setShow] = useState(false);
    const { t } = useTranslation();
    return (
        <div className="border-t border-base-200 pt-1">
            <div className="flex items-center justify-between gap-3 px-1 py-2 rounded-lg hover:bg-base-200 cursor-pointer" onClick={() => !loading && onToggle()}>
                <div className="flex items-center gap-2 flex-1"><Calendar size={16} className="text-base-content/50" /><span className="text-xs opacity-70">{t('sync.schedule') as string}</span></div>
                <div className="relative flex items-center gap-2" onClick={e => e.stopPropagation()} onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
                    <Info size={14} className="text-base-content/40 cursor-help" />
                    <AnimatePresence>{show && <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="absolute bottom-full right-0 mb-2 w-64 bg-base-200 rounded-lg shadow-lg border p-3 z-[100]"><p className="text-xs leading-relaxed">{t('sync.tooltip') as string}</p></motion.div>}</AnimatePresence>
                    <input type="checkbox" className="toggle toggle-primary toggle-sm" checked={enabled ?? false} disabled={loading || enabled === null} readOnly />
                </div>
            </div>
        </div>
    );
}
