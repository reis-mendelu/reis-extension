import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { AppearanceRows } from '../screens/profile/AppearanceRows';
import { SystemNotificationsRow } from '../screens/profile/SystemNotificationsRow';
import { HiddenLessonsRows } from '../screens/profile/HiddenLessonsRows';

export interface SettingsSheetProps {
  onClose: () => void;
}

/**
 * Nastavení: what a student sets once and rarely revisits (spec 2026-10-09).
 * One row on Profile opens it, so Profile itself stays a short list of things
 * to DO — and has room to. Hidden lessons come back from here too.
 */
export function SettingsSheet({ onClose }: SettingsSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('mobile.profile.settings')} onClose={onClose} />
      {/* Scrolls: the hidden-lessons list has no length limit, and the sheet
          caps its height (PR #638 review). */}
      <div className="min-h-0 flex-1 overflow-y-auto pb-6">
        <SystemNotificationsRow />
        <AppearanceRows />
        {/* Where the first-hide hint sends a student (HideLessonSheet). */}
        <HiddenLessonsRows />
      </div>
    </Sheet>
  );
}
