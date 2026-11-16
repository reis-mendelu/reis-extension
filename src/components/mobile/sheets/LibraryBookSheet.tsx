import { useState } from 'react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { LibraryConfirm, type LibraryPick } from './LibraryConfirm';

/**
 * The phone's confirm: the same summary the iPad shows in its side panel, in a
 * sheet. It cannot be dismissed while the library is answering: closing it then
 * would leave the booking running behind a sheet that is gone.
 */
export function LibraryBookSheet({ sheet, onClose }: { sheet: LibraryPick; onClose: () => void }) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const close = sending ? () => undefined : onClose;
  return (
    <Sheet size="content" onClose={close} elevated>
      <SheetHeader title={t('mobile.library.confirmTitle')} onClose={close} />
      <div className="px-4 pb-5">
        <LibraryConfirm pick={sheet} onClose={onClose} onSending={setSending} />
      </div>
    </Sheet>
  );
}
