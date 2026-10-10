import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { ImpersonationPicker } from '../../Impersonation/ImpersonationPicker';

/** Phone/iPad wrapper around the picker the desktop drawer also renders. */
export function ImpersonationSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Sheet size="content" onClose={onClose}>
      <SheetHeader title={t('impersonation.title')} onClose={onClose} />
      <ImpersonationPicker onStarted={onClose} />
    </Sheet>
  );
}
