import { useState } from 'react';
import { Check, Info, X } from 'lucide-react';
import { useAppStore } from '../../../../../store/useAppStore';
import { useTranslation } from '../../../../../hooks/useTranslation';
import { useWideViewport } from '../../../../../hooks/ui/useWideViewport';
import { useLibraryStore } from '../../../../../mobile/library/libraryStore';
import { cardPick } from '../../../../../mobile/library/libraryDay';
import { useLibraryBook } from '../../../sheets/useLibraryBook';
import { LibraryConfirm } from '../../../sheets/LibraryConfirm';

/** Below this window height the first booking's confirm opens as a sheet, not inline in the rail. */
const INLINE_MIN_HEIGHT = 600;

/**
 * What is picked, and the one labelled button that books it. A footer of the
 * panel, below the scrolling grid and above the floating nav bar: it takes its
 * own room, so it never covers a cell or a "+". The first booking on a device goes
 * through the confirm (a sheet on the phone, inline on the iPad), which says what
 * the library receives; after it a tap on the button books straight away, and the
 * "i" says it again for anyone who wants to read it.
 */
export function LibraryBar({ flush }: { flush?: boolean }) {
  const room = useLibraryStore((s) => s.room);
  const storeDay = useLibraryStore((s) => s.day);
  const storePicked = useLibraryStore((s) => s.picked);
  // The same day and hours the card shows: a pick from a day that has passed is none.
  const { day, picked } = cardPick({ day: storeDay, picked: storePicked }, new Date());
  if (room === null || storeDay === null || !picked.length) return null;
  const pick = { featureId: room, day, from: picked[0]!, to: picked[picked.length - 1]! + 1 };
  return <PickBar pick={pick} flush={flush} />;
}

function PickBar({
  pick,
  flush,
}: {
  pick: { featureId: number; day: string; from: number; to: number };
  flush?: boolean;
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
    // Inline only where the rail has the height for it: a landscape phone is wide but 390 px tall.
    else if (wide && window.innerHeight >= INLINE_MIN_HEIGHT) setInline(true);
    else pushSheet({ kind: 'libraryBook', ...pick });
  };

  return (
    <div
      data-testid="library-bar"
      className={`shrink-0 space-y-2 border-t border-base-content/15 pt-3 ${
        flush ? 'bg-base-100 px-5 pb-4' : 'bg-base-200 px-4 pb-4'
      }`}
    >
      {inline && <LibraryConfirm pick={pick} onClose={() => setInline(false)} />}
      {info && !inline && (
        <p className="text-sm text-base-content/70">{t('mobile.library.confirmBody')}</p>
      )}
      {!inline && (
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <p className="truncate text-md font-semibold text-base-content">{name}</p>
              <button
                type="button"
                aria-label={t('mobile.library.infoLabel')}
                aria-pressed={info}
                onClick={() => setInfo(!info)}
                className="btn btn-ghost btn-circle btn-xs shrink-0 text-base-content/60"
              >
                <Info size={16} aria-hidden="true" />
              </button>
            </div>
            <p className="whitespace-nowrap text-sm tabular-nums text-base-content/70">
              {t('mobile.library.pickLine', { time: when, n })}
            </p>
          </div>
          <button
            type="button"
            aria-label={t('mobile.library.clearPick')}
            disabled={sending}
            onClick={() => useLibraryStore.getState().clearPick()}
            className="btn btn-ghost btn-circle btn-sm"
          >
            <X size={20} aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={sending || writing}
            onClick={book}
            className="btn border-0 bg-primary text-primary-content hover:bg-primary/90"
          >
            {sending ? (
              <span className="loading loading-spinner loading-sm" aria-hidden="true" />
            ) : (
              <Check size={20} aria-hidden="true" />
            )}
            {t('mobile.library.confirm')}
          </button>
        </div>
      )}
    </div>
  );
}
