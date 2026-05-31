/**
 * CloseButton - Consistent close/dismiss button.
 * 
 * Consolidates the repeated pattern:
 * "absolute right-2 top-2 w-6 h-6 xl:w-8 xl:h-8 flex justify-center items-center text-gray-500 cursor-pointer hover:scale-90 transition-all"
 */

import { X } from 'lucide-react';
import { cn } from '../../ui/utils';

export interface CloseButtonProps {
    onClick: () => void;
    /** Size variant */
    size?: 'sm' | 'md';
    /** Position - absolute positioned by default */
    positioned?: boolean;
    /** Additional CSS classes */
    className?: string;
}

export function CloseButton({
    onClick,
    size = 'md',
    positioned = true,
    className
}: CloseButtonProps) {
    const sizeClasses = size === 'sm'
        ? 'w-6 h-6'
        : 'w-6 h-6 xl:w-8 xl:h-8';

    const iconSize = size === 'sm' ? 16 : 20;

    return (
        <button
            type="button"
            onClick={onClick}
            className={cn(
                'flex justify-center items-center text-base-content/60 cursor-pointer hover:scale-90 transition-all',
                positioned && 'absolute right-2 top-2',
                sizeClasses,
                className
            )}
            aria-label="Close"
        >
            <X size={iconSize} />
        </button>
    );
}
