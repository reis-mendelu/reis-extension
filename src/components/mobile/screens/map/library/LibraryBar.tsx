import { useState } from 'react';
import { Check, Info, X } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useWideViewport } from '../../../../../hooks/ui/useWideViewport';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { useLibraryBook } from '../../../sheets/useLibraryBook';
import { LibraryConfirm } from '../../../sheets/LibraryConfirm';

/**
 * What is picked, and the one button that books it. Fixed to the card's bottom
 * edge while a pick exists. The first booking on a device goes through the
 * confirm (a sheet on the phone, inline on the iPad), which says what the library
 * receives; after it a tap on the check books straight away, and the "i" says it
 * again for anyone who wants to read it.
 */
export function LibraryBar({
  pick,
}: {
  pick: { featureId: number; day: string; from: number; to: number };
}) {
  const { t } = useTranslation();
  const wide = useWideViewport();
  const pushSheet = useAppStore((s) => s.pushSheet);
  const noticeSeen = useLibraryStore((s) => s.noticeSeen);
  const writing = useLibraryStore((s) => s.writing);
  const [inline, setInline] = useState(false);
  const [info, setInfo] = useState(false);
  const { sending, confirm, name, when } = useLibraryBook(pick, () => undefined);
  const n = pick.to - pick.from;

  const book = () => {
    if (noticeSeen) void confirm();
    else if (wide) setInline(true);
    else pushSheet({ kind: 'libraryBook', ...pick });
  };

  return (
    <div
      data-testid="library-bar"
      className="sticky bottom-0 z-10 -mx-1 space-y-2 rounded-2xl bg-base-100 p-3 shadow-lg ring-1 ring-base-content/15"
    >
      {inline && <LibraryConfirm pick={pick} onClose={() => setInline(false)} />}
      {info && !inline && (
        <p className="text-sm text-base-content/70">{t('mobile.library.confirmBody')}</p>
      )}
      {!inline && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-md font-semibold text-base-content">{name}</p>
            <p className="text-sm tabular-nums text-base-content/70">
              {t('mobile.library.pickLine', { time: when, n })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('mobile.library.infoLabel')}
            aria-pressed={info}
            onClick={() => setInfo(!info)}
            className="btn btn-ghost btn-circle btn-sm text-base-content/60"
          >
            <Info size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('mobile.library.clearPick')}
            disabled={sending}
            onClick={() => useLibraryStore.getState().clearPick()}
            className="btn btn-ghost btn-circle"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label={t('mobile.library.confirm')}
            disabled={sending || writing}
            onClick={book}
            className="btn btn-primary btn-circle"
          >
            {sending ? (
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
            ) : (
              <Check size={22} aria-hidden="true" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
