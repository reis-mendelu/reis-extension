import { motion, AnimatePresence } from 'motion/react';
import { Users, ChevronDown, ChevronRight } from 'lucide-react';
import { ASSOCIATION_PROFILES } from '../../../services/spolky/config';
import { useTranslation } from '../../../hooks/useTranslation';

export function SpolkySection({ expanded, onToggle, isSub, onToggleAssoc }: any) {
    const { t } = useTranslation();
    return (
        <div className="mt-2 border-t border-base-200">
            <button onClick={onToggle} className="w-full flex items-center justify-between px-1 py-3 hover:bg-base-200 rounded-lg group">
                <div className="flex items-center gap-2"><Users size={16} className="text-base-content/50 group-hover:text-primary" /><span className="text-xs font-medium opacity-70">{t('sync.spolky')}</span></div>
                {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <AnimatePresence>{expanded && <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden"><div className="space-y-1 mb-2 px-1 max-h-40 overflow-y-auto custom-scrollbar">
                {Object.values(ASSOCIATION_PROFILES).map((p: any) => <label key={p.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-base-200 rounded-md cursor-pointer"><span className="text-xs opacity-90">{p.name}</span><input type="checkbox" className="checkbox checkbox-xs checkbox-primary" checked={isSub(p.id)} onChange={() => onToggleAssoc(p.id)} /></label>)}
            </div></motion.div>}</AnimatePresence>
        </div>
    );
}
