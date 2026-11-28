import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { ImpersonationPicker } from '../../Impersonation/ImpersonationPicker';

/** Phone/iPad wrapper around the picker the desktop drawer also renders. */
export function ImpersonationSheet({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const closePicker = useAppStore((s) => s.closeImpersonationPicker);
  // Like the desktop drawer: closing it cancels a one-off still starting.
  const close = () => {
    closePicker();
    onClose();
  };
  return (
    <Sheet size="content" onClose={close}>
      <SheetHeader title={t('impersonation.title')} onClose={close} />
      <ImpersonationPicker onStarted={onClose} />
    </Sheet>
  );
}
