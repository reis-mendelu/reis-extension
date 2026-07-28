import type { ReactNode } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

export interface ExamRowCardProps {
    /** Bold first line — the assessment type ("Zkouška", "Zápočet"). */
    title: string;
    /** Muted second line — which subject it belongs to. */
    subtitle: string;
    /** Right column, first line: the date for a registered exam, the free-slot
     *  count for an open one. Carries the accent colour. */
    primaryMeta: string;
    /** Right column, second line: room, or how many terms are on offer. */
    secondaryMeta: string;
    expanded: boolean;
    onToggle: () => void;
    children?: ReactNode;
}

/**
 * One exam row. The assessment type leads and the subject follows beneath it,
 * which reads oddly out of context but is right here: a student scanning this
 * screen during exam season is looking for *what kind of thing* is happening
 * and *when*, and the same subject can appear two or three times with different
 * assessment types.
 *
 * The left accent bar is the only always-on colour in the row, so a glance down
 * the list reads as a column of markers rather than a wall of cards.
 */
export function ExamRowCard({
    title, subtitle, primaryMeta, secondaryMeta, expanded, onToggle, children,
}: ExamRowCardProps) {
    return (
        <div className="overflow-hidden rounded-2xl border border-base-300 bg-base-100">
            <button
                type="button"
                aria-expanded={expanded}
                onClick={onToggle}
                className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left"
            >
                <span className="h-8 w-1 flex-shrink-0 rounded-full bg-primary" />
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span className="truncate text-md font-bold text-base-content">{title}</span>
                    <span className="truncate text-2sm text-base-content/60">{subtitle}</span>
                </span>
                <span className="flex flex-shrink-0 flex-col items-end gap-0.5">
                    <span className="whitespace-nowrap text-2sm font-bold text-success">{primaryMeta}</span>
                    <span className="whitespace-nowrap text-2sm text-base-content/60">{secondaryMeta}</span>
                </span>
                {expanded
                    ? <ChevronUp size={16} className="flex-shrink-0 text-base-content/40" />
                    : <ChevronDown size={16} className="flex-shrink-0 text-base-content/40" />}
            </button>
            {expanded && children && <div className="flex flex-col gap-2 px-3.5 pb-3">{children}</div>}
        </div>
    );
}
