import { useState } from 'react';
import type { ReactNode } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import type { ExamSubject, ExamSection } from '../../types/exams';

export interface SignupGroupProps {
  rows: { subject: ExamSubject; section: ExamSection }[];
  renderCard: (subject: ExamSubject, section: ExamSection) => ReactNode;
}

/**
 * "Zápisy na cvičení" on the extension — the desktop half of the phone's
 * signup group of the same name (report #37). Seminar-group signup comes
 * through IS's exam-terms table; it is shown, folded away below the exams and
 * with no badge, each section on its ordinary exam card.
 */
export function SignupGroup({ rows, renderCard }: SignupGroupProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  if (rows.length === 0) return null;
  const Chevron = open ? ChevronDown : ChevronRight;
  return (
    <div data-testid="exam-signup-group" className="space-y-3 pt-2">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left text-xs font-bold uppercase tracking-wider text-base-content/70 hover:text-base-content"
      >
        <Chevron size={14} className="shrink-0" aria-hidden="true" />
        <span>{t('exams.signupGroup')}</span>
        <span className="rounded-full bg-base-300 px-1.5 py-0.5 text-xs font-semibold">
          {rows.length}
        </span>
        <span className="flex-1 border-b border-base-content/20" />
      </button>
      {open && rows.map(({ subject, section }) => renderCard(subject, section))}
    </div>
  );
}
