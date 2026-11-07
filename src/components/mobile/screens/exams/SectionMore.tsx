import { useState } from 'react';
import { useTranslation } from '../../../../hooks/useTranslation';
import type { ExamSection } from '../../../../types/exams';
import { MoreChip } from './MoreChip';
import { TermDetails } from './TermDetails';

/**
 * The single "Více" of a card the student is not registered on, as wide as the
 * card, like the registered card's.
 *
 * Ten terms each with a "Více" opened the same form, length and teacher's note
 * ten times over. The rows keep what differs between them (date, seats, until
 * when they take registrations) and this holds what does not — read off the
 * first term, as the registered card reads its own.
 */
export function SectionMore({ section, now }: { section: ExamSection; now: Date }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const first = section.terms[0];
  if (!first) return null;
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
      {open && (
        <TermDetails term={first} section={section} isRegHere={false} now={now} scope="section" />
      )}
    </>
  );
}
