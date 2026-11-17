import { CreditCard } from 'lucide-react';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { iskamOffered, useIskamStore } from '../../../../mobile/iskam/iskamStore';
import { NavRow } from '../../primitives/NavRow';

/**
 * The profile's way into the ISIC balance and Dobít — the same row the
 * jídelníček sheet shows, in a sheet of its own (`IskamSheet`).
 *
 * The check starts from this tap, as MenuCard's does: never from opening the
 * profile, which would ask WebISKAM on every visit. So the row cannot show the
 * balance itself — the store keeps it only while a sheet is open — and says
 * what is inside instead. Hidden where WebISKAM cannot be reached (the
 * extension, the dev webapp, the demo): it would open an empty sheet there.
 * Phone/iPad only — src/test/guards/desktopHasNoIskam.test.ts.
 */
export function IskamProfileRow() {
  const { t } = useTranslation();
  const pushSheet = useAppStore((s) => s.pushSheet);
  if (!iskamOffered()) return null;
  return (
    <NavRow
      icon={CreditCard}
      label={t('mobile.profile.isic')}
      sublabel={t('mobile.profile.isicSub')}
      onClick={() => {
        void useIskamStore.getState().check();
        pushSheet({ kind: 'isic' });
      }}
    />
  );
}
