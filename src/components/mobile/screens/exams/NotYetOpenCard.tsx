import { useTranslation } from '../../../../hooks/useTranslation';
import { pluralSuffix } from '../../../../utils/plural';
import { formatOpensAt } from '../../../../utils/mobile/examOpening';
import type { OpenExam } from '../../../../utils/mobile/examRows';
import type { ExamSection } from '../../../../types/exams';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';

export interface NotYetOpenCardProps {
  row: OpenExam;
  /** When the earliest of this section's terms opens for registration. */
  earliest: Date;
  locale: string;
  expanded: boolean;
  onToggle: () => void;
  isProcessing: boolean;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * A section IS has not opened for registration yet.
 *
 * Its own component rather than a fourth closure inside ExamsScreen, which is
 * already past the 200-line line. The row is the ordinary one; only the right
 * column differs — where a bookable section says how many slots are free, this
 * says when there will be any.
 *
 * The terms still render underneath, and TermRow still decides for itself that
 * they cannot be registered: this card changes what the student is told, not
 * what they are allowed to do.
 */
export function NotYetOpenCard({
  row,
  earliest,
  locale,
  expanded,
  onToggle,
  isProcessing,
  onRegister,
}: NotYetOpenCardProps) {
  const { t, language } = useTranslation();
  return (
    <ExamRowCard
      title={row.sectionName}
      subtitle={row.subjectName}
      primaryMeta={t('mobile.exams.opensAt', { when: formatOpensAt(earliest, locale) })}
      // Not the accent: nothing here can be acted on yet, and the green that
      // means "bookable" three rows down would be a lie about this one.
      primaryTone="muted"
      secondaryMeta={t(
        `mobile.exams.termCount${pluralSuffix(language, row.section.terms.length)}`,
        {
          count: row.section.terms.length,
        }
      )}
      expanded={expanded}
      onToggle={onToggle}
    >
      {row.section.terms.map((term) => (
        <TermRow
          key={term.id}
          term={term}
          section={row.section}
          isProcessing={isProcessing}
          onRegister={onRegister}
        />
      ))}
    </ExamRowCard>
  );
}
