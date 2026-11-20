import { useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ArrowDownToLine } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { openAppUpdate } from '../../mobile/appUpdate';
import { desktopDialogMotion } from '../Feedback/feedbackModalMotion';
import { useDialogFocus } from './useDialogFocus';

/**
 * "A fixed version of reIS is out": the pop-up for an install below the
 * critical version (utils/criticalUpdate decides when; at most twice).
 *
 * The one message on the phone that is not a row in Novinky
 * (one-place-per-message), on purpose and pinned in
 * test/guards/extensionHasNoAppUpdate.test.ts: it says the app itself is
 * broken, which a row in a list the student never opens could not. Always
 * closable — tapping outside, "Teď ne" — and never a reason to block reIS.
 *
 * The reason comes from the `critical_app_version` row, in the app's language.
 */
export function CriticalUpdateDialog() {
  const { t, language } = useTranslation();
  const critical = useAppStore((s) => s.criticalUpdate);
  const open = useAppStore((s) => s.criticalPopupOpen);
  const close = useAppStore((s) => s.closeCriticalPopup);
  const updateRef = useRef<HTMLButtonElement>(null);
  const laterRef = useRef<HTMLButtonElement>(null);
  useDialogFocus(open && !!critical, close, updateRef, laterRef);

  return (
    <AnimatePresence>
      {open && critical && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center px-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            data-testid="critical-update-backdrop"
            className="absolute inset-0 bg-black/60"
            onClick={close}
          />
          <motion.div
            {...desktopDialogMotion}
            role="dialog"
            aria-modal="true"
            aria-labelledby="critical-update-title"
            className="relative z-10 flex w-full max-w-sm flex-col items-center gap-3 rounded-2xl border border-base-300 bg-base-100 px-6 pt-6 pb-5 text-center shadow-2xl"
          >
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <ArrowDownToLine size={26} aria-hidden />
            </span>
            <h3
              id="critical-update-title"
              className="font-display text-lg font-bold text-base-content"
            >
              {t('appUpdate.critical.popupTitle')}
            </h3>
            <p className="text-sm text-base-content/75">{critical.reason[language]}</p>
            <button
              ref={updateRef}
              type="button"
              className="btn btn-primary mt-2 w-full"
              onClick={() => {
                close();
                void openAppUpdate('critical_update_opened');
              }}
            >
              {t('appUpdate.critical.update')}
            </button>
            <button
              ref={laterRef}
              type="button"
              className="btn btn-ghost btn-sm w-full"
              onClick={close}
            >
              {t('appUpdate.critical.later')}
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
