import { motion, AnimatePresence } from 'motion/react';
import { Moon, MessageSquarePlus } from 'lucide-react';
import { useState } from 'react';
import { useOutlookSync } from '../../hooks/data';
import { useTheme } from '../../hooks/useTheme';
import { useSpolkySettings } from '../../hooks/useSpolkySettings';
import { SpolkySection } from './Profile/SpolkySection';
import { OutlookSyncToggle } from './Profile/OutlookSyncToggle';

export function ProfilePopup({ isOpen, onOpenFeedback }: { isOpen: boolean; onOpenFeedback?: () => void }) {
  const { isEnabled, isLoading: syncLoading, toggle: tSync } = useOutlookSync(), { isDark, isLoading: tLoading, toggle: tTheme } = useTheme(), { isSubscribed, toggleAssociation } = useSpolkySettings(), [spolkyOpen, setSpolkyOpen] = useState(false);
  if (!isOpen) return null;
  return (
    <AnimatePresence><motion.div initial={{ opacity: 0, x: 10, scale: 0.95 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 10, scale: 0.95 }} className="absolute left-14 bottom-0 w-72 bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-3 z-50">
        <div className="px-1 py-1 border-b border-base-200 mb-3"><h3 className="font-semibold">Nastavení</h3></div>
        {onOpenFeedback && <button onClick={onOpenFeedback} className="w-full flex items-center gap-3 px-1 py-2 hover:bg-base-200 rounded-lg transition-colors mb-2"><MessageSquarePlus size={16} className="text-primary" /><span className="text-xs font-medium">Nahlásit chybu / Nápad</span></button>}
        <SpolkySection expanded={spolkyOpen} onToggle={() => setSpolkyOpen(!spolkyOpen)} isSub={isSubscribed} onToggleAssoc={toggleAssociation} />
        <OutlookSyncToggle enabled={isEnabled} loading={syncLoading} onToggle={tSync} />
        <div><label className="flex items-center justify-between gap-3 px-1 py-2 cursor-pointer hover:bg-base-200 rounded-lg"><div className="flex items-center gap-2 flex-1"><Moon size={16} className="text-base-content/50" /><span className="text-xs opacity-70">Tmavý režim</span></div><input type="checkbox" className="toggle toggle-primary toggle-sm" checked={isDark} disabled={tLoading} onChange={tTheme} /></label></div>
    </motion.div></AnimatePresence>
  );
}
