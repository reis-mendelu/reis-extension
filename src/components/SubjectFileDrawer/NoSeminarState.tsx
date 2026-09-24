import { Presentation } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { ISBacklink } from './ISBacklink';

/**
 * A lecture-only subject has no seminar group — the only roster reIS reads —
 * so its classmates list is empty for that reason, not because nobody takes
 * the subject. Say so, and hand over IS's own list of everyone enrolled.
 *
 * The link shows even where the tab hides its end-of-list backlink (phone):
 * here it is the answer to the empty state, not a duplicate of one.
 */
export function NoSeminarState({ isUrl }: { isUrl: string | null }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Presentation size={48} className="mb-4 text-base-content/20" />
      <p className="font-semibold text-base-content">{t('classmates.noSeminarTitle')}</p>
      <p className="mt-1 max-w-xs text-sm text-base-content/70">{t('classmates.noSeminarHint')}</p>
      {isUrl && <ISBacklink href={isUrl} showBorder={false} />}
    </div>
  );
}
