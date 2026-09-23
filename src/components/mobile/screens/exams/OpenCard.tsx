import { useTranslation } from '../../../../hooks/useTranslation';
import { pluralSuffix } from '../../../../utils/plural';
import { getSectionState } from '../../../ExamPanel/utils';
import type { OpenExam } from '../../../../utils/mobile/examRows';
import type { ExamSection } from '../../../../types/exams';
import { ExamRowCard } from './ExamRowCard';
import { TermRow } from './TermRow';

export interface OpenCardProps {
  row: OpenExam;
  /** The store's clock, so the free-slot count and the tests agree on "now". */
  now: Date;
  expanded: boolean;
  onToggle: () => void;
  isProcessing: boolean;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * A section with slots the student can actually take.
 *
 * Sections whose registration has not opened are NOT here — they are their own
 * group above this one (see `NotYetOpenCard` and `utils/mobile/examOpening`),
 * because a count of "open slots" that includes things nobody can book is not a
 * count of anything.
 */
export function OpenCard({
  row,
  now,
  expanded,
  onToggle,
  isProcessing,
  onRegister,
}: OpenCardProps) {
  const { t, language } = useTranslation();
  const state = getSectionState(row.section, now);
  const openCount = state.type === 'open' ? state.openCount : 0;
  return (
    <ExamRowCard
      title={row.subjectName}
      subtitle={row.sectionName}
      primaryMeta={openCount > 0 ? `${openCount} ${t('exams.available')}` : ''}
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
