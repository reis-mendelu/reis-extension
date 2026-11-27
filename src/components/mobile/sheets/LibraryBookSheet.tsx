import { useState } from 'react';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useTranslation } from '../../../hooks/useTranslation';
import { useAppStore } from '../../../store/useAppStore';
import { LibraryConfirm } from './LibraryConfirm';
import type { LibraryPick } from './useLibraryBook';

/**
 * The phone's confirm: the same summary the iPad shows in its side panel, in a
 * sheet. A drag, the backdrop and its close button are inert while the library
 * is answering. Escape (a hardware keyboard) can still close it: the booking
 * then finishes behind it, its toast still shows, the store's write lock keeps
 * a second booking from starting, and the late close pops only this sheet.
 */
export function LibraryBookSheet({ sheet, onClose }: { sheet: LibraryPick; onClose: () => void }) {
  const { t } = useTranslation();
  const [sending, setSending] = useState(false);
  const close = sending ? () => undefined : onClose;
  // The booking's answer can arrive after Android Back closed this sheet; then
  // the sheet on top is someone else's and stays.
  const closeIfTop = () => {
    const st = useAppStore.getState();
    if (st.mobileSheets.at(-1) === sheet) st.popSheet();
  };
  return (
    <Sheet size="content" onClose={close} elevated>
      <SheetHeader title={t('mobile.library.confirmTitle')} onClose={close} />
      <div className="px-4 pb-5">
        <LibraryConfirm pick={sheet} onClose={closeIfTop} onSending={setSending} />
      </div>
    </Sheet>
  );
}
