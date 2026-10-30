import { ClipboardList } from 'lucide-react';
import { useTranslation } from '../../../hooks/useTranslation';

export type ZaznamnikEmptyReason = 'noData' | 'noAssessment' | 'notLoaded' | 'nothingYet';

/**
 * Where marks would be, a quiet placeholder: the clipboard glyph and a word or
 * two. Nobody read the sentence it replaced (Dominik, 2026-10-29), so the
 * sentence is now the accessible name only. The same block stands alone in the
 * tab or under the sections that open it.
 */
export function ZaznamnikEmpty({ reason }: { reason: ZaznamnikEmptyReason }) {
  const { t } = useTranslation();
  return (
    <div
      role="img"
      aria-label={t(`zaznamnik.${reason}`)}
      className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border border-dashed border-base-content/15"
    >
      <ClipboardList className="w-10 h-10 text-base-content/40" aria-hidden />
      <span className="text-xs font-medium text-base-content/70">
        {t(`zaznamnik.emptyShort.${reason}`)}
      </span>
    </div>
  );
}
