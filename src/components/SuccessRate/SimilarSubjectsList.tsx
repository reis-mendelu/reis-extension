import { ChevronRight } from 'lucide-react';
import type { SimilarSuggestion } from '../../types/schemas/similarSubjects.schema';
import { useAppStore } from '../../store/useAppStore';
import { useTranslation } from '../../hooks/useTranslation';
import { computeFailRate } from '../SubjectsPanel/computeFailRate';
import { failRateTone } from '../SubjectsPanel/failRateTone';
import {
  changeNote,
  displayName,
  reasonPhrase,
  sharedChangeNote,
  staleYear,
} from './similarLabels';

/** The old subject's fail rate, as the same chip the Předměty list shows. */
function FailChip({ code }: { code: string }) {
  const rate = computeFailRate(useAppStore((s) => s.successRates[code]));
  if (rate == null) return null;
  return (
    <span
      className={`flex-shrink-0 rounded px-1.5 py-0.5 text-xs font-medium tabular-nums ${failRateTone(rate)}`}
    >
      {rate}%
    </span>
  );
}

/** Old subjects a student can preview, as rows like Předměty. Each says why it
 * was offered — facts, never a claim that it is this subject's predecessor. */
export function SimilarSubjectsList({
  suggestions,
  onPick,
}: {
  suggestions: SimilarSuggestion[];
  onPick: (code: string) => void;
}) {
  const { t, language } = useTranslation();
  const shared = sharedChangeNote(suggestions, t);
  return (
    <section className="mx-auto w-full max-w-xl px-3" aria-label={t('successRate.similarHeading')}>
      <div className="flex items-baseline justify-between px-2 pb-1">
        <h3 className="text-sm font-semibold text-base-content/70">
          {t('successRate.similarHeading')}
        </h3>
        <span className="text-xs text-base-content/60">{t('successRate.failRateColumn')}</span>
      </div>
      {shared && (
        <p className="px-2 pb-1 text-xs text-[var(--tone-warning)]">
          {t('successRate.allOfThem', { note: shared })}
        </p>
      )}
      <ul className="divide-y divide-base-content/10">
        {suggestions.map((s) => {
          const year = staleYear(s.lastYear);
          const note = shared ? null : changeNote(s, t);
          const meta = [s.code, reasonPhrase(s, t), year && t('successRate.lastTaught', { year })]
            .filter(Boolean)
            .join(', ');
          return (
            <li key={s.code}>
              <button
                type="button"
                onClick={() => onPick(s.code)}
                className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2.5 text-left hover:bg-base-200 active:bg-base-200"
              >
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-md font-medium">
                    {displayName(s, language)}
                  </span>
                  <span className="mt-0.5 block text-xs text-base-content/60">{meta}</span>
                  {note && (
                    <span className="mt-0.5 block text-xs text-[var(--tone-warning)]">{note}</span>
                  )}
                </span>
                <FailChip code={s.code} />
                <ChevronRight size={18} className="mt-0.5 flex-shrink-0 text-base-content/40" />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
