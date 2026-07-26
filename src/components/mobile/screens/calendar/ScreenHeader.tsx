import type { ReactNode } from 'react';

export interface ScreenHeaderProps {
    eyebrow: string;
    title: string;
    action?: ReactNode;
}

/** The shared screen title block: small eyebrow above a display-face title. */
export function ScreenHeader({ eyebrow, title, action }: ScreenHeaderProps) {
    return (
        <div className="flex flex-shrink-0 items-end justify-between px-5 pb-1 pt-5">
            <div className="flex flex-col gap-0.5">
                <span className="text-xs font-medium text-base-content/60">{eyebrow}</span>
                <span className="font-display text-2xl font-extrabold tracking-tight">{title}</span>
            </div>
            {action}
        </div>
    );
}
