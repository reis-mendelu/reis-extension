import { Presentation } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { ISBacklink } from './ISBacklink';

interface NoSeminarStateProps {
  isUrl: string | null;
  /** Switches the tab's toggle to Celý předmět. */
  onShowSubject: () => void;
}

/**
 * The Cvičení side of the toggle for a lecture-only subject: there is no
 * seminar group, so the list is empty for that reason, not because nobody
 * takes the subject. Say so, and hand over the whole-subject list — reIS's own
 * first, IS's after it.
 *
 * The link shows even where the tab hides its end-of-list backlink (phone):
 * here it is part of the answer to the empty state, not a duplicate of one.
 */
export function NoSeminarState({ isUrl, onShowSubject }: NoSeminarStateProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <Presentation size={48} className="mb-4 text-base-content/20" />
      <p className="font-semibold text-base-content">{t('classmates.noSeminarTitle')}</p>
      <p className="mt-1 max-w-xs text-sm text-base-content/70">{t('classmates.noSeminarHint')}</p>
      <button type="button" className="btn btn-primary btn-sm mt-4" onClick={onShowSubject}>
        {t('classmates.showWholeSubject')}
      </button>
      {isUrl && <ISBacklink href={isUrl} showBorder={false} />}
    </div>
  );
}
