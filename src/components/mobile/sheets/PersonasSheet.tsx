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

  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('impersonation.personas.title')} onClose={onClose} />
      <div className="pb-3">
        <PersonaList
          variant="touch"
          hideTitle
          onDone={onClose}
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
