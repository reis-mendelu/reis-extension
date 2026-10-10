import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { CalendarViewRow } from '../screens/profile/CalendarViewRow';
import { AppearanceRows } from '../screens/profile/AppearanceRows';

export interface SettingsSheetProps {
  onClose: () => void;
}

/**
 * Nastavení: what a student sets once and rarely revisits (spec 2026-10-09).
 * One row on Profile opens it, so Profile itself stays a short list of things
 * to DO — and has room to.
 */
export function SettingsSheet({ onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('mobile.profile.settings')} onClose={onClose} />
      <div className="pb-6">
        <CalendarViewRow />
        <AppearanceRows />
      </div>
    </Sheet>
  );
}
