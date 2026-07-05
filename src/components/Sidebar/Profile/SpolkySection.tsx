import { motion, AnimatePresence } from 'motion/react';
import { Users, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { ASSOCIATION_PROFILES } from '../../../services/spolky/config';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';

interface SpolkySectionProps {
  expanded: boolean;
  onToggle: () => void;
  isSub: (id: string) => boolean;
  onToggleAssoc: (id: string) => void;
}

export function SpolkySection({ expanded, onToggle, isSub, onToggleAssoc }: SpolkySectionProps) {
  const { t } = useTranslation();
  const openSocietyAdmin = useAppStore((s) => s.openSocietyAdmin);
  return (
    <div>
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-1 py-2 hover:bg-base-200 rounded-lg group"
      >
        <div className="flex items-center gap-2">
          <Users size={16} className="text-base-content/50 group-hover:text-primary" />
          <span className="text-xs font-medium opacity-70">{t('sync.spolky') as string}</span>
        </div>
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-1 mb-2 px-1 max-h-40 overflow-y-auto custom-scrollbar">
              {Object.values(ASSOCIATION_PROFILES).map((p) => (
                <label
                  key={p.id}
                  className="flex items-center justify-between px-2 py-1.5 hover:bg-base-200 rounded-md cursor-pointer"
                >
                  <span className="text-[xs] opacity-90">{p.name}</span>
                  <input
                    type="checkbox"
                    className="checkbox checkbox-xs checkbox-primary"
                    checked={isSub(p.id)}
                    onChange={() => onToggleAssoc(p.id)}
                  />
                </label>
              ))}
            </div>
            <button
              onClick={openSocietyAdmin}
              className="w-full flex items-center justify-between px-2 py-1.5 mt-1 hover:bg-base-200 rounded-md text-xs opacity-60 hover:opacity-100 transition-colors"
            >
              <span className="flex items-center gap-2">
                <Shield size={14} className="text-base-content/50" />
                {t('admin.manageButton') as string}
              </span>
              <span aria-hidden="true">→</span>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
