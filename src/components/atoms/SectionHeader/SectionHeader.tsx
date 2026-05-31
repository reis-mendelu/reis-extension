/**
 * SectionHeader - Consistent section title styling.
 * 
 * Consolidates the repeated pattern:
 * "text-gray-500 text-sm font-medium uppercase tracking-wide mb-1"
 */

import { cn } from '../../ui/utils';

export interface SectionHeaderProps {
    children: React.ReactNode;
    /** Optional margin bottom override */
    className?: string;
}

export function SectionHeader({ children, className }: SectionHeaderProps) {
    return (
        <h3
            className={cn(
                'text-base-content/60 text-sm font-medium uppercase tracking-wide mb-1',
                className
            )}
        >
            {children}
        </h3>
    );
}
