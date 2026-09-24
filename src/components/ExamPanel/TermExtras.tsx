import { Users } from 'lucide-react';
import type { ExamTerm } from '../../types/exams';
import { useTranslation } from '../../hooks/useTranslation';
import { useAppStore } from '../../store/useAppStore';
import { termPeopleUrl } from '../../utils/mobile/termPeopleUrl';

/**
 * A term's length and IS's "Kdo jde se mnou na termín" page, for the desktop
 * tree — the two facts the phone's TermDetails carries that the tiles did not.
 * Inline spans, so it sits in whichever footer row it is put in.
 *
 * The length is the one the sync attached (services/sync/examDurations); none
 * is shown where IS has none. No fetch of its own: a tile is one of many on
 * screen, and the sync has already asked.
 */
export function TermExtras({ term }: { term: ExamTerm }) {
  const { t, language } = useTranslation();
  const studiumId = useAppStore((s) => s.studiumId);
  const obdobiId = useAppStore((s) => s.obdobiId);
  const whoUrl = termPeopleUrl(term, studiumId, obdobiId, language);
  const minutes = typeof term.durationMinutes === 'number' ? term.durationMinutes : null;

  return (
    <>
      {minutes !== null && (
        <span className="text-base-content/40">
          {t('exams.durationLabel')}{' '}
          <b className="text-base-content/60">{t('exams.durationMin', { count: minutes })}</b>
        </span>
      )}
      {whoUrl && (
        <a
          href={whoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="link link-hover inline-flex items-center gap-1 text-base-content/50 hover:text-primary"
        >
          <Users size={10} className="shrink-0" />
          {t('exams.whoIsGoing')}
        </a>
      )}
    </>
  );
}
