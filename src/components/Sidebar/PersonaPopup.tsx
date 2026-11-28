import { motion } from 'motion/react';
import { ChevronRight, Settings } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { PersonaList } from '../Impersonation/PersonaList';

/**
 * What a reIS admin's avatar opens (decision #16, 2026-11-28): "Zobrazit jako"
 * first, the profile one row down. Same floating panel and position as
 * `ProfilePopup`, which "Profil a nastavení" swaps in. Students never see it.
 */
export function PersonaPopup({
  onClose,
  onProfile,
}: {
  onClose: () => void;
  onProfile: () => void;
}) {
  const { t } = useTranslation();
  const openImpersonationPicker = useAppStore((s) => s.openImpersonationPicker);

  return (
    <motion.div
      initial={{ opacity: 0, x: 10, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      data-testid="persona-popup"
      className="absolute left-14 bottom-0 w-72 max-w-[calc(100vw-5rem)] max-h-[calc(100dvh-1.5rem)] overflow-y-auto bg-base-100 rounded-xl shadow-popover-heavy border border-base-300 p-2 z-50"
    >
      <PersonaList
        variant="compact"
        onDone={onClose}
        onOther={() => {
          openImpersonationPicker();
          onClose();
        }}
      />
      <div className="my-1 h-px bg-base-200" />
      <button
        type="button"
        onClick={onProfile}
        className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-xs transition-colors hover:bg-base-200"
      >
        <span className="flex w-4 flex-shrink-0 justify-center">
          <Settings size={14} className="text-base-content/50" aria-hidden />
        </span>
        <span className="flex-1 font-medium">{t('impersonation.personas.profile')}</span>
        <ChevronRight size={14} className="flex-shrink-0 text-base-content/40" aria-hidden />
      </button>
    </motion.div>
  );
}
