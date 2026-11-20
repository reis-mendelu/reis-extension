import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useScreenSignal } from '../../../hooks/useScreenSignal';
import { useIskamResetOnLeave } from './useIskamResetOnLeave';
import { IskamBalanceRow } from './IskamBalanceRow';

export interface IskamSheetProps {
  onClose: () => void;
}

/**
 * The ISIC balance and Dobít, opened from the profile. Holds the very row the
 * jídelníček sheet shows, so the two ways in cannot drift apart.
 *
 * Counts `screen_isic` when shown (a label of its own: `screen_menu` would
 * miscount). Install id and fixed label only, declared in privacy/disclosures.ts.
 * Phone/iPad only — src/test/guards/desktopHasNoIskam.test.ts.
 */
export function IskamSheet({ onClose }: IskamSheetProps) {
  useScreenSignal('screen_isic');
  const { t } = useTranslation();
  // As in MenuSheet: the balance never outlives the sheet.
  useIskamResetOnLeave();
  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('mobile.profile.isic')} onClose={onClose} />
      <div className="pb-4">
        <IskamBalanceRow />
      </div>
    </Sheet>
  );
}
