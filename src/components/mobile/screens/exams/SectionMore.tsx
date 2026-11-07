import { useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { ExamSection } from '../../../../types/exams';
import { MoreChip } from './MoreChip';
import { SectionDetails } from './SectionDetails';

/**
 * The single "Více" of a card the student is not registered on, as wide as the
 * card, like the registered card's.
 *
 * Ten terms each with a "Více" opened the same form, length and teacher's note
 * ten times over. The rows keep what differs between them (date, seats, until
 * when they take registrations) and this holds only what every term shares.
 */
export function SectionMore({ section }: { section: ExamSection }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (section.terms.length === 0) return null;
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={t('mobile.exams.sectionDetailsAria')}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center"
      >
        <MoreChip open={open} wide />
      </button>
      {open && <SectionDetails section={section} />}
    </>
  );
}
