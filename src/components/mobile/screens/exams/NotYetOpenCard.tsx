import { useTranslation } from '../../../../hooks/useTranslation';
import { pluralSuffix } from '../../../../utils/plural';
import type { OpenExam } from '../../../../utils/mobile/examRows';
import type { ExamSection } from '../../../../types/exams';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';

export interface NotYetOpenCardProps {
  row: OpenExam;
  /** The store's clock, passed through to each term row. */
  now: Date;
  expanded: boolean;
  onToggle: () => void;
  isProcessing: boolean;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * A section IS has not opened for registration yet.
 *
 * Its own component rather than a fourth closure inside ExamsScreen, which is
 * already past the 200-line line.
 *
 * The header says nothing about when registration opens. Each term row carries
 * its own opening moment instead — sections hand out terms that open on
 * different days, and a single section-level date (the earliest of them) was
 * right about one row and wrong about the rest.
 *
 * The terms still render underneath, and TermRow still decides for itself that
 * they cannot be registered: this card changes what the student is told, not
 * what they are allowed to do.
 */
export function NotYetOpenCard({
  row,
  now,
  expanded,
  onToggle,
  isProcessing,
  onRegister,
}: NotYetOpenCardProps) {
  const { t, language } = useTranslation();
  return (
    <ExamRowCard
      title={row.subjectName}
      subtitle={row.sectionName}
      primaryMeta=""
      accent="warning"
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
          now={now}
          isProcessing={isProcessing}
          onRegister={onRegister}
        />
      ))}
    </ExamRowCard>
  );
}
