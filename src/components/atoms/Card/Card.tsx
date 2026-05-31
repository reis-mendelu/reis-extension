/**
 * Card - Consistent card/widget container.
 * 
 * Consolidates the repeated pattern:
 * "bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col justify-between relative overflow-hidden group hover:shadow-md transition-all"
 */

import { cn } from '../../ui/utils';

export interface CardProps {
    children: React.ReactNode;
    /** Variant - determines styling */
    variant?: 'widget' | 'popup' | 'container';
    /** Whether to show hover effect */
    hoverable?: boolean;
    /** Custom padding */
    padding?: 'none' | 'sm' | 'md' | 'lg';
    /** Additional CSS classes */
    className?: string;
}

const variantClasses = {
    widget: 'bg-base-100 rounded-2xl shadow-sm border border-base-300',
    popup: 'bg-base-100 rounded-xl shadow-popover-heavy border border-base-300',
    container: 'bg-base-100 rounded-2xl shadow-sm border border-base-300 overflow-hidden',
} as const;

const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
} as const;

export function Card({
    children,
    variant = 'widget',
    hoverable = true,
    padding = 'md',
    className
}: CardProps) {
    return (
        <div
            className={cn(
                variantClasses[variant],
                paddingClasses[padding],
                hoverable && 'hover:shadow-md transition-all',
                'relative overflow-hidden',
                className
            )}
        >
            {children}
        </div>
    );
}

// Sub-components for compound pattern
export function CardHeader({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex items-center justify-between mb-4', className)}>
            {children}
        </div>
    );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('flex-1', className)}>
            {children}
        </div>
    );
}

export function CardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
    return (
        <div className={cn('mt-4 pt-4 border-t border-base-300', className)}>
            {children}
        </div>
    );
}
