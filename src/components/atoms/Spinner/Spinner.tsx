/**
 * Spinner - Unified loading indicator component.
 *
 * Consolidates 8+ spinner implementations across the codebase.
 * Uses brand colors by default with size variants.
 */

import { cn } from '../../ui/utils';

export interface SpinnerProps {
  /** Size variant */
  size?: 'xs' | 'sm' | 'md' | 'lg';
  /** Color variant - defaults to primary green */
  variant?: 'primary' | 'muted' | 'white';
  /** Additional CSS classes */
  className?: string;
}

const sizeClasses = {
  xs: 'h-3 w-3',
  sm: 'h-5 w-5',
  md: 'h-8 w-8',
  lg: 'h-16 w-16',
} as const;

const variantClasses = {
  primary: 'border-brand-primary',
  muted: 'border-gray-500',
  white: 'border-white',
} as const;

export function Spinner({ size = 'md', variant = 'primary', className }: SpinnerProps) {
  return (
    <div
      className={cn(
        'animate-spin rounded-full border-b-2',
        sizeClasses[size],
        variantClasses[variant],
        className
      )}
      role="status"
      aria-label="Loading"
    />
  );
}
