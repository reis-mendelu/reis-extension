import type { ReactNode } from 'react';
import { Users } from 'lucide-react';
import type { ExamSection, ExamTerm } from '../../../../types/exams';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useExamNote } from '../../../../hooks/data/useExamNote';
import { parseRegistrationStart } from '../../../../utils/termUtils';
import { formatOpensAtBare } from '../../../../utils/mobile/examOpening';
import { termDeadline } from '../../../../utils/mobile/examDeadline';
import { termPeopleUrl } from '../../../../utils/mobile/termPeopleUrl';

export interface TermDetailsProps {
  term: ExamTerm;
  section: ExamSection;
  /** The student is registered on THIS term. */
  isRegHere: boolean;
  /** The store's clock, so "has registration opened yet" matches the row. */
  now: Date;
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-2sm text-base-content/60">{label}</dt>
      <dd className="text-right text-2sm font-medium text-base-content">{children}</dd>
    </div>
  );
}

/** "8. 11. 20:00" from IS's "08.11.2026 20:00"; the raw string if it does not parse. */
function deadline(raw: string): string {
  const parsed = parseRegistrationStart(raw);
  return parsed ? formatOpensAtBare(parsed) : raw;
}

/**
 * What a single term's terminy_info.pl page says, under that term's row.
 *
 * Per term, never per subject: deadlines differ term by term — four Python
 * terms can stop taking registrations on four different days — so a "until"
 * shown once for the whole subject would be wrong for three of them.
 *
 * The length is on the detail page only. The sync attaches it to every term
 * (`examDurations`); a term it has not reached yet is fetched when opened —
 * the same request that reads the teacher's Poznámka.
 *
 * No "Místo konání" row and no map button: the room is already on the term's
 * own line, and the map is the map tab's job.
 */
export function TermDetails({ term, section, isRegHere, now }: TermDetailsProps) {
  const { t, language } = useTranslation();
  const studiumId = useAppStore((s) => s.studiumId);
  const obdobiId = useAppStore((s) => s.obdobiId);
  const fetched = useAppStore((s) => s.examTermDurations[term.id]);
  const { isLoading } = useExamNote(term.id);

  const form = (language === 'en' ? term.sectionFormEn : term.sectionFormCs) || term.sectionForm;
  const minutes =
    term.durationMinutes ??
    (isRegHere ? section.registeredTerm?.durationMinutes : undefined) ??
    fetched;
  // One line, the one the student can act on — see utils/mobile/examDeadline.
  const deadlineRow = termDeadline(term, section, isRegHere, now);
  const whoUrl = termPeopleUrl(term, studiumId, obdobiId, language);

  return (
    <div data-testid="term-details" className="flex flex-col gap-2 border-t border-base-300 pt-2">
      <dl className="flex flex-col gap-1">
        {form && <Fact label={t('mobile.exams.detailForm')}>{form}</Fact>}
        {(minutes != null || isLoading) && (
          <Fact label={t('mobile.exams.detailDuration')}>
            {minutes != null ? t('mobile.exams.durationMin', { count: minutes }) : '…'}
          </Fact>
        )}
        {deadlineRow && (
          <Fact label={t(`mobile.exams.${deadlineRow.kind}`)}>{deadline(deadlineRow.value)}</Fact>
        )}
      </dl>
      <div className="flex flex-col gap-2">
        {whoUrl && (
          <a
            href={whoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-11 w-full items-center justify-center gap-1.5 whitespace-nowrap rounded-lg bg-base-200 px-3 text-2sm font-semibold text-base-content"
          >
            <Users size={14} className="flex-shrink-0" />
            {t('mobile.exams.whoIsGoing')}
          </a>
        )}
      </div>
    </div>
  );
}
