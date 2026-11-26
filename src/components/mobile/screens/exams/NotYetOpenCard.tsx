import { useTranslation } from '../../../../hooks/useTranslation';
import { pluralSuffix } from '../../../../utils/plural';
import type { OpenExam } from '../../../../utils/mobile/examRows';
import type { ExamSection } from '../../../../types/exams';
import { formatOpensAtBare } from '../../../../utils/mobile/examOpening';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';
import { AttemptBadgeLegend } from './AttemptBadgeLegend';
import { SectionMore } from './SectionMore';

export interface NotYetOpenCardProps {
  row: OpenExam;
  /** The store's clock, passed through to each term row. */
  now: Date;
  /** When the section's earliest term opens (`splitByRegistrationOpen`). */
  opensAt: Date;
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
 * The collapsed header says "od <earliest opening>", so the date a student came
 * for is visible without opening the card. "od" (from), not "otevírá se": a
 * section hands out terms that open on different days, and "from the earliest"
 * is true of every row where "opens at the earliest" was right about one.
 * Each term row still carries its own opening moment underneath.
 *
 * The terms still render underneath, and TermRow still decides for itself that
 * they cannot be registered: this card changes what the student is told, not
 * what they are allowed to do.
 */
export function NotYetOpenCard({
  row,
  now,
  opensAt,
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
      primaryMeta={t('mobile.exams.opensFrom', { when: formatOpensAtBare(opensAt) })}
      primaryTone="muted"
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
      {/* One "Více" for the card; the rows open nothing and say inline until
          when they take registrations, as under a registered card. */}
      <SectionMore section={row.section} />
      {row.section.terms.map((term) => (
        <TermRow
          key={term.id}
          term={term}
          section={row.section}
          showDetails={false}
          now={now}
          isProcessing={isProcessing}
          onRegister={onRegister}
        />
      ))}
      <AttemptBadgeLegend terms={row.section.terms} />
    </ExamRowCard>
  );
}
