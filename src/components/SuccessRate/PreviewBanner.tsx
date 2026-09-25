import { ChevronLeft } from 'lucide-react';
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';
import { useTranslation } from '../../hooks/useTranslation';
import { changeNote, displayName } from './similarLabels';

/** One quiet line above the chart — outside its scroll area, so no screenshot
 * of a preview can be mistaken for the subject's own numbers. */
export function PreviewBanner({
  suggestion,
  onBack,
}: {
  suggestion: SimilarSuggestion;
  onBack: () => void;
}) {
  const { t, language } = useTranslation();
  const note = changeNote(suggestion, t);
  return (
    <div
      role="status"
      className="flex shrink-0 items-center gap-1 border-b border-base-content/10 px-2 py-2"
    >
      <button
        type="button"
        onClick={onBack}
        aria-label={t('successRate.back')}
        className="btn btn-square btn-ghost btn-sm"
      >
        <ChevronLeft size={20} />
      </button>
      <div className="min-w-0">
        <div className="text-xs text-base-content/60">{t('successRate.previewOf')}</div>
        <div className="truncate text-sm font-medium">
          {displayName(suggestion, language)}{' '}
          <span className="font-normal text-base-content/60">{suggestion.code}</span>
        </div>
        {note && <div className="text-xs text-[var(--tone-warning)]">{note}</div>}
      </div>
    </div>
  );
}
