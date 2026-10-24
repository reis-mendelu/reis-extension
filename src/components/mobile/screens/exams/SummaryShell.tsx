import type { ReactNode } from 'react';

export interface SummaryShellProps {
  /** False: a plain column, nothing to open. */
  expandable: boolean;
  open: boolean;
  label: string;
  onToggle: () => void;
  children: ReactNode;
}

/**
 * The left column of a term row: the button that opens its details, or, under
 * a registered card where the card's own "Více" holds them, the same lines
 * with nothing to tap.
 */
export function SummaryShell({ expandable, open, label, onToggle, children }: SummaryShellProps) {
  const className = 'flex min-w-0 flex-1 flex-col gap-0.5 text-left';
  if (!expandable) return <div className={className}>{children}</div>;
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-label={label}
      onClick={onToggle}
      className={className}
    >
      {children}
    </button>
  );
}
