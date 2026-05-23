import { AlertTriangle } from 'lucide-react';
import { useExamNote } from '../../hooks/data/useExamNote';
import { useTranslation } from '../../hooks/useTranslation';

/**
 * Renders the teacher's Poznámka inline under a term tile. Triggers a lazy
 * fetch on mount. Hides entirely when there's no note (most terms).
 *
 * IS Mendelu uses red text in their own UI to flag rules with pass/fail
 * consequences ("no AI allowed", "automatic F", etc.). We preserve that
 * signal via `note.isEmphasized` from the parser.
 */
export function TermNoteBlock({ terminId }: { terminId: string }) {
    const { t } = useTranslation();
    const { note, isLoading } = useExamNote(terminId);

    if (isLoading && note === undefined) {
        return (
            <div className="px-3 py-1.5 border-t border-base-200/60 flex items-center gap-1.5 text-[10px] text-base-content/40 italic">
                <span className="loading loading-dots loading-xs" />
                <span>{t('exams.loadingNote')}</span>
            </div>
        );
    }

    if (!note) return null;

    return (
        <div
            onClick={e => e.stopPropagation()}
            className={`px-3 py-2 border-t text-xs leading-relaxed ${
                note.isEmphasized
                    ? 'bg-error/5 border-error/20 text-base-content/90'
                    : 'bg-base-200/30 border-base-200/60 text-base-content/75'
            }`}
        >
            <div className="flex items-start gap-1.5">
                <AlertTriangle
                    size={13}
                    className={`mt-0.5 shrink-0 ${note.isEmphasized ? 'text-error' : 'text-base-content/40'}`}
                />
                <div className="whitespace-pre-wrap">{note.text}</div>
            </div>
        </div>
    );
}
