import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { PersonaList } from '../../Impersonation/PersonaList';

/**
 * A reIS admin's "Zobrazit jako" on the phone and iPad, opened from their own
 * avatar on Profil (decision #16, 2026-11-28). On the sheet stack, so Android
 * back closes it. The same list the desktop avatar opens.
 */
export function PersonasSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const replaceSheet = useAppStore((s) => s.replaceSheet);
  const loadImpersonationOptions = useAppStore((s) => s.loadImpersonationOptions);
  // A slow switch can land after another sheet opened over this one (a
  // notification, say): close only while this sheet is still the top one.
  const closeIfOnTop = () => {
    if (useAppStore.getState().mobileSheets.at(-1)?.kind === 'personas') onClose();
  };

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('impersonation.personas.title')} onClose={onClose} />
      {/* Its own scroller: ten rows, or more with error lines, can pass the
          panel's 85dvh on a short phone or in landscape. */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-3">
        <PersonaList
          variant="touch"
          hideTitle
          onDone={closeIfOnTop}
          // In this sheet's place, not on top: the picker closes itself when a
          // one-off starts, and this list would be left open under it. Options
          // load from this tap, never from an effect.
          onOther={() => {
            void loadImpersonationOptions();
            replaceSheet({ kind: 'impersonation' });
          }}
        />
      </div>
    </Sheet>
  );
}
