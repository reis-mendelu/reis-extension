import type { ReactNode } from 'react';

export interface ScreenHeaderProps {
    eyebrow: string;
    title: string;
    action?: ReactNode;
}

/** The shared screen title block: small eyebrow above a display-face title. */
export function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
    return (
        <div className="flex flex-shrink-0 items-end justify-between gap-3 px-5 pb-1 pt-5">
            {/* min-w-0 + truncate keeps the eyebrow on one line: a long one
                ("B-OI prez - ZS 2025/2026") wrapped at 320px and pushed the
                title out of line with the action button beside it. */}
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-base-content/60">{eyebrow}</span>
                <span className="truncate font-display text-2xl font-extrabold tracking-tight">{title}</span>
            </div>
            {action}
        </div>
    );
}
