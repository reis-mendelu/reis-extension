import { useState } from 'react';
import { toast } from 'sonner';
import { Sheet } from '../primitives/Sheet';
import { SheetHeader } from '../primitives/SheetHeader';
import { useAppStore } from '../../../store/useAppStore';
import { useTranslation } from '../../../hooks/useTranslation';
import { cancelAndRemove } from '../../../mobile/library/bookingActions';
import { logError } from '../../../utils/reportError';

/**
 * What a library booking's calendar block offers when tapped: cancelling the
 * real booking, and nothing else. Removing only the block would leave a
 * reservation nobody can see, so there is no such button. The block goes only
 * when the library has confirmed; an unanswered cancel keeps it.
 */
export function LibraryCancelSheet({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const { t } = useTranslation();
  const block = useAppStore((s) => s.customEvents.find((e) => e.id === eventId));
  const [sending, setSending] = useState(false);
  if (!block) return null;

  const cancel = async () => {
    if (sending) return;
    setSending(true);
    try {
      const r = await cancelAndRemove(eventId);
      if (r.kind === 'ok' || r.kind === 'gone') toast.success(t('mobile.library.cancelled'));
      else if (r.kind === 'unknown') toast.error(t('mobile.library.cancelUnknown'));
      else {
        logError('Library.cancel', new Error(`status ${r.status}`));
        toast.error(t('mobile.library.cancelFailed'));
      }
    } catch (err) {
      logError('Library.cancel', err);
      toast.error(t('mobile.library.cancelFailed'));
    }
    onClose();
  };

  return (
    <Sheet size="content" onClose={sending ? () => undefined : onClose} elevated>
      <SheetHeader title={t('mobile.library.cancelTitle')} onClose={onClose} />
      <div className="flex flex-col gap-3 px-4 pb-5">
        <div className="rounded-xl bg-base-200 p-3">
          <span className="text-md font-semibold text-base-content">{block.title}</span>
          <span className="block text-sm text-base-content/70">
            {block.startTime}–{block.endTime}
          </span>
        </div>
        <p className="text-sm text-base-content/70">{t('mobile.library.cancelBody')}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="min-h-11 flex-1 rounded-xl border border-base-300 text-base font-semibold text-base-content/70"
          >
            {t('mobile.library.keep')}
          </button>
          <button
            type="button"
            onClick={() => void cancel()}
            disabled={sending}
            className="btn btn-error min-h-11 flex-1 rounded-xl text-base"
          >
            {sending ? t('mobile.library.cancelling') : t('mobile.library.cancelAction')}
          </button>
        </div>
      </div>
    </Sheet>
  );
}
