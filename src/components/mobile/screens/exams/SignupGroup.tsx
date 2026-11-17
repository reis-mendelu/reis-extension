import { useTranslation } from '../../../../hooks/useTranslation';
import { getSectionState } from '../../../ExamPanel/utils';
import type { OpenExam } from '../../../../utils/mobile/examRows';
import type { ExamSection } from '../../../../types/exams';
import { ExamGroup } from './ExamGroup';
import { OpenCard } from './OpenCard';
import { NotYetOpenCard } from './NotYetOpenCard';

export interface SignupGroupProps {
  rows: OpenExam[];
  now: Date;
  expandedId: string | null;
  onToggle: (id: string) => void;
  processingSectionId: string | null;
  onRegister: (section: ExamSection, termId: string) => void;
}

/**
 * "Zápisy na cvičení": seminar-group signup, collapsed at the bottom of
 * Zkoušky (report #37). IS serves these through the exam-terms table; they
 * are real terms a student may want (an excursion) or may already sit in (an
 * assigned group, #344), so they are shown — but apart from the exams and
 * folded away, with no badge.
 *
 * Inside, each section keeps the card it would get as an exam: bookable terms
 * keep Přihlásit, ones IS will not let the student near say so with "Proč?".
 */
export function SignupGroup({
  rows,
  now,
  expandedId,
  onToggle,
  processingSectionId,
  onRegister,
}: SignupGroupProps) {
  const { t } = useTranslation();
  if (rows.length === 0) return null;
  return (
    <ExamGroup
      title={t('mobile.exams.groupSignup')}
      count={rows.length}
      tone="signup"
      defaultOpen={false}
    >
      {rows.map((row) => {
        const id = row.section.id;
        const common = {
          row,
          now,
          expanded: expandedId === id,
          onToggle: () => onToggle(id),
          isProcessing: processingSectionId === id,
          onRegister,
        };
        if (getSectionState(row.section, now).type === 'opening')
          return <NotYetOpenCard key={id} {...common} />;
        const blocked =
          row.section.terms.length > 0 && row.section.terms.every((term) => term.cannotRegister);
        return <OpenCard key={id} {...common} accent={blocked ? 'neutral' : 'info'} />;
      })}
    </ExamGroup>
  );
}
