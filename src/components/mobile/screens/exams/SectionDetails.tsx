import type { ExamSection } from '../../../../types/exams';
import { useAppStore } from '../../../../store/useAppStore';
import { useTranslation } from '../../../../hooks/useTranslation';
import { useExamNotes } from '../../../../hooks/data/useExamNotes';
import { sectionFacts } from '../../../../utils/mobile/sectionFacts';
import { Fact, NoteBlock } from './DetailParts';

/**
 * What a card's single "Více" opens: only the facts every term of the section
 * shares (see utils/mobile/sectionFacts).
 *
 * Never a deadline or "Kdo jde se mnou": both are per term, and the rows say
 * their own "Přihlášení do" inline. TermDetails stays the per-term block,
 * under the registered card's header.
 */
export function SectionDetails({ section }: { section: ExamSection }) {
  const { t, language } = useTranslation();
  const durations = useAppStore((s) => s.examTermDurations);
  const notes = useAppStore((s) => s.examNotes);
  const loading = useAppStore((s) => s.examNotesLoading);
  useExamNotes(section.terms.map((term) => term.id));

  const { room, form, minutes, note, waiting } = sectionFacts({
    terms: section.terms,
    language,
    durations,
    notes,
    loading,
  });
  // Say so rather than open a bare strip: with nothing shared it holds nothing.
  const empty = !room && !form && minutes == null && !note && !waiting;

  return (
    <div data-testid="term-details" className="flex flex-col gap-2 border-t border-base-300 pt-2">
      {empty && <p className="text-2sm text-base-content/60">{t('mobile.exams.noDetails')}</p>}
      <dl className="flex flex-col gap-1">
        {room && <Fact label={t('mobile.exams.detailRoom')}>{room}</Fact>}
        {form && <Fact label={t('mobile.exams.detailForm')}>{form}</Fact>}
        {(minutes != null || waiting) && (
          <Fact label={t('mobile.exams.detailDuration')}>
            {minutes != null ? t('mobile.exams.durationMin', { count: minutes }) : '…'}
          </Fact>
        )}
      </dl>
      {note && <NoteBlock note={note} />}
    </div>
  );
}
