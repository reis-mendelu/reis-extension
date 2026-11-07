import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useIskamResetOnLeave } from './useIskamResetOnLeave';
import { IskamBalanceRow } from './IskamBalanceRow';

export interface IskamSheetProps {
  onClose: () => void;
}

/**
 * The ISIC balance and Dobít, opened from the profile. Holds the very row the
 * jídelníček sheet shows, so the two ways in cannot drift apart.
 *
 * No screen signal: `screen_menu` would miscount, and a new label changes what
 * reIS sends. Phone/iPad only — src/test/guards/desktopHasNoIskam.test.ts.
 */
export function IskamSheet({ onClose }: IskamSheetProps) {
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
