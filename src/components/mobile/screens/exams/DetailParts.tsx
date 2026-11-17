import type { ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';
import type { TermNote } from '../../../../api/terminyInfo';
import { useTranslation } from '../../../../hooks/useTranslation';

/** One "label … value" line of an exam's details. */
export function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-2sm text-base-content/60">{label}</dt>
      <dd className="text-right text-2sm font-medium text-base-content">{children}</dd>
    </div>
  );
}

/**
 * The teacher's Poznámka: the desktop's TermNoteBlock, at the phone's type
 * size. IS writes rules with pass/fail consequences in red; the warning tone
 * keeps that. Headed like the facts above, so it reads as the teacher's note.
 */
export function NoteBlock({ note }: { note: TermNote }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-1">
      <span className="text-2sm text-base-content/60">{t('mobile.exams.detailNote')}</span>
      <div
        data-testid="term-note"
        className="flex items-start gap-1.5 rounded-lg bg-base-200/60 px-2.5 py-2 text-2sm leading-relaxed"
      >
        <AlertTriangle
          size={14}
          className={`mt-0.5 shrink-0 ${note.isEmphasized ? 'text-[var(--tone-warning)]' : 'text-base-content/60'}`}
        />
        <div className="min-w-0 whitespace-pre-wrap break-words text-base-content/80">
          {note.text}
        </div>
      </div>
    </div>
  );
}
